"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withOrgContext } from "@/lib/db/with-org-context";
import { requireBiddingAccess } from "@/lib/licitacoes/access";
import { logSecurityEvent } from "@/lib/audit/log";
import { optionalTextSchema, optionalUrlSchema, firstIssueMessage } from "@/lib/validation";
import { parseMoneyInput, parseBrasiliaDateTime } from "@/lib/licitacoes/tender-input";
import { createSupabaseAdminClient, LICITACOES_BUCKET } from "@/lib/supabase/admin";

const tenderSchema = z.object({
  agency: z.string().trim().min(1, "Informe o órgão contratante.").max(200, "Órgão muito longo."),
  object: z.string().trim().min(1, "Informe o objeto da licitação.").max(2000, "Objeto muito longo (máximo 2000 caracteres)."),
  editalNumber: optionalTextSchema("Número do edital", 100),
  processNumber: optionalTextSchema("Número do processo", 100),
  modality: optionalTextSchema("Modalidade", 100),
  city: optionalTextSchema("Cidade", 100),
  state: optionalTextSchema("UF", 2),
  sourcePortal: optionalTextSchema("Portal", 150),
  officialUrl: optionalUrlSchema,
  notes: optionalTextSchema("Observações", 3000),
});

function readTender(formData: FormData, failTo: string) {
  const fail = (m: string): never => redirect(`${failTo}${failTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(m)}`);
  const g = (k: string) => String(formData.get(k) ?? "");

  const parsed = tenderSchema.safeParse({
    agency: g("agency"),
    object: g("object"),
    editalNumber: g("editalNumber"),
    processNumber: g("processNumber"),
    modality: g("modality"),
    city: g("city"),
    state: g("state").toUpperCase(),
    sourcePortal: g("sourcePortal"),
    officialUrl: g("officialUrl"),
    notes: g("notes"),
  });
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  const estimatedValue = parseMoneyInput(g("estimatedValue"));
  const opensAt = parseBrasiliaDateTime(g("opensAt"));
  const questionsDeadline = parseBrasiliaDateTime(g("questionsDeadline"));
  if (estimatedValue === undefined) return fail("Valor estimado inválido.");
  if (opensAt === undefined) return fail("Data de abertura inválida.");
  if (questionsDeadline === undefined) return fail("Prazo de esclarecimentos inválido.");

  return { ...parsed.data, estimatedValue, opensAt, questionsDeadline };
}

export async function createTender(formData: FormData) {
  const { organizationId, userId } = await requireBiddingAccess();
  const data = readTender(formData, "/licitacoes/nova");

  const tender = await withOrgContext(organizationId, async (tx) => {
    const t = await tx.tender.create({ data: { organizationId, createdById: userId, responsibleUserId: userId, ...data } });
    await tx.tenderStageEvent.create({ data: { tenderId: t.id, organizationId, fromStage: null, toStage: "IDENTIFICADA", userId } });
    return t;
  });
  await logSecurityEvent({ type: "licitacoes.tender_created", actorUserId: userId, organizationId, targetId: tender.id });
  revalidatePath("/licitacoes");
  redirect(`/licitacoes/${tender.id}`);
}

export async function updateTender(id: string, formData: FormData) {
  const { organizationId, userId } = await requireBiddingAccess();
  const data = readTender(formData, `/licitacoes/${id}`);

  const { count } = await withOrgContext(organizationId, (tx) => tx.tender.updateMany({ where: { id, organizationId }, data }));
  if (count === 0) redirect("/licitacoes");

  await logSecurityEvent({ type: "licitacoes.tender_updated", actorUserId: userId, organizationId, targetId: id });
  revalidatePath(`/licitacoes/${id}`);
  redirect(`/licitacoes/${id}?saved=1`);
}

export async function deleteTender(id: string) {
  const { organizationId, userId } = await requireBiddingAccess();

  const docs = await withOrgContext(organizationId, async (tx) => {
    const t = await tx.tender.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!t) return null;
    return tx.tenderDocument.findMany({ where: { tenderId: id, organizationId }, select: { storagePath: true } });
  });
  if (!docs) redirect("/licitacoes");

  // Arquivos primeiro: se o Storage falhar, a licitação continua existindo e
  // dá pra tentar de novo — o contrário deixaria arquivos órfãos sem dono.
  if (docs.length > 0) {
    const { error } = await createSupabaseAdminClient().storage.from(LICITACOES_BUCKET).remove(docs.map((d) => d.storagePath));
    if (error) redirect(`/licitacoes/${id}?error=${encodeURIComponent("Não foi possível apagar os arquivos. Tente novamente.")}`);
  }
  await withOrgContext(organizationId, (tx) => tx.tender.deleteMany({ where: { id, organizationId } }));

  await logSecurityEvent({ type: "licitacoes.tender_deleted", actorUserId: userId, organizationId, targetId: id, metadata: { documents: docs.length } });
  revalidatePath("/licitacoes");
  redirect("/licitacoes");
}
