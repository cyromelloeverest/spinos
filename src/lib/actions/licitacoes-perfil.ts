"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withOrgContext } from "@/lib/db/with-org-context";
import { requireBiddingAccess } from "@/lib/licitacoes/access";
import { logSecurityEvent } from "@/lib/audit/log";
import { splitList } from "@/lib/form-utils";
import { boundedListSchema, optionalTextSchema, firstIssueMessage } from "@/lib/validation";
import { isHabilitacaoCategory, parseDateInput } from "@/lib/licitacoes/habilitacao";

const PAGE = "/licitacoes/perfil";

function fail(message: string): never {
  redirect(`${PAGE}?error=${encodeURIComponent(message)}`);
}

function done(): never {
  revalidatePath(PAGE);
  redirect(`${PAGE}?saved=1`);
}

const profileSchema = z.object({
  services: boundedListSchema("Serviços", 40, 150),
  regions: boundedListSchema("Regiões", 40, 100),
  technicalCapabilities: optionalTextSchema("Capacidade técnica", 3000),
  teamAvailable: optionalTextSchema("Equipe disponível", 2000),
  minMarginPct: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) < 100), { message: "Margem mínima deve ser um percentual entre 0 e 99." })
    .transform((v) => (v === "" ? null : Number(v))),
  notes: optionalTextSchema("Observações", 3000),
});

export async function saveBidderProfile(formData: FormData) {
  const { organizationId, userId } = await requireBiddingAccess();

  const result = profileSchema.safeParse({
    services: splitList(formData.get("services")),
    regions: splitList(formData.get("regions")),
    technicalCapabilities: String(formData.get("technicalCapabilities") ?? ""),
    teamAvailable: String(formData.get("teamAvailable") ?? ""),
    minMarginPct: String(formData.get("minMarginPct") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!result.success) fail(firstIssueMessage(result.error));

  await withOrgContext(organizationId, (tx) =>
    tx.bidderProfile.upsert({
      where: { organizationId },
      create: { organizationId, ...result.data },
      update: result.data,
    }),
  );
  await logSecurityEvent({ type: "licitacoes.profile_updated", actorUserId: userId, organizationId, targetId: organizationId });
  done();
}

const documentSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do documento.").max(150, "Nome muito longo."),
  number: optionalTextSchema("Número", 100),
  issuer: optionalTextSchema("Órgão emissor", 150),
});

function readDocumentFields(formData: FormData) {
  const parsed = documentSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    number: String(formData.get("number") ?? ""),
    issuer: String(formData.get("issuer") ?? ""),
  });
  if (!parsed.success) fail(firstIssueMessage(parsed.error));
  const issuedAt = parseDateInput(String(formData.get("issuedAt") ?? ""));
  const expiresAt = parseDateInput(String(formData.get("expiresAt") ?? ""));
  if (issuedAt === undefined) fail("Data de emissão inválida.");
  if (expiresAt === undefined) fail("Data de validade inválida.");
  if (issuedAt && expiresAt && expiresAt < issuedAt) fail("A validade não pode ser anterior à emissão.");
  return { ...parsed.data, issuedAt, expiresAt };
}

export async function addBidderDocument(formData: FormData) {
  const { organizationId, userId } = await requireBiddingAccess();

  const category = String(formData.get("category") ?? "");
  if (!isHabilitacaoCategory(category)) fail("Categoria inválida.");
  const fields = readDocumentFields(formData);

  const doc = await withOrgContext(organizationId, (tx) =>
    tx.bidderDocument.create({ data: { organizationId, category, createdById: userId, ...fields } }),
  );
  await logSecurityEvent({ type: "licitacoes.bidder_document_added", actorUserId: userId, organizationId, targetId: doc.id });
  done();
}

// Renovar não sobrescreve: cria uma nova versão apontando pra anterior, e o
// histórico (número, emissão, validade antigos) continua no banco.
export async function renewBidderDocument(previousId: string, formData: FormData) {
  const { organizationId, userId } = await requireBiddingAccess();
  const fields = readDocumentFields(formData);

  const created = await withOrgContext(organizationId, async (tx) => {
    const previous = await tx.bidderDocument.findFirst({ where: { id: previousId, organizationId } });
    if (!previous) return null;
    // Só a versão atual de uma cadeia pode ser renovada — impede bifurcar o histórico.
    const alreadyRenewed = await tx.bidderDocument.findFirst({ where: { previousVersionId: previous.id, organizationId }, select: { id: true } });
    if (alreadyRenewed) return "renovado" as const;
    return tx.bidderDocument.create({
      data: {
        organizationId,
        category: previous.category,
        version: previous.version + 1,
        previousVersionId: previous.id,
        createdById: userId,
        ...fields,
      },
    });
  });
  if (!created) fail("Documento não encontrado.");
  if (created === "renovado") fail("Esse documento já foi renovado — renove a versão mais recente.");

  await logSecurityEvent({ type: "licitacoes.bidder_document_renewed", actorUserId: userId, organizationId, targetId: created.id, metadata: { previousId } });
  done();
}

export async function removeBidderDocument(id: string) {
  const { organizationId, userId } = await requireBiddingAccess();

  const removed = await withOrgContext(organizationId, async (tx) => {
    const doc = await tx.bidderDocument.findFirst({ where: { id, organizationId } });
    if (!doc) return false;
    // Remove a cadeia inteira de versões: apagar só a mais nova deixaria a
    // anterior "reaparecer" como atual, com dados vencidos.
    const chain: string[] = [];
    let cursor: typeof doc | null = doc;
    while (cursor) {
      chain.push(cursor.id);
      cursor = cursor.previousVersionId
        ? await tx.bidderDocument.findFirst({ where: { id: cursor.previousVersionId, organizationId } })
        : null;
    }
    // SQL: previousVersionId não é FK, então a ordem não importa.
    await tx.bidderDocument.deleteMany({ where: { id: { in: chain }, organizationId } });
    return true;
  });
  if (!removed) fail("Documento não encontrado.");

  await logSecurityEvent({ type: "licitacoes.bidder_document_removed", actorUserId: userId, organizationId, targetId: id });
  done();
}

const certificateSchema = z.object({
  title: z.string().trim().min(1, "Informe o título do atestado.").max(200, "Título muito longo."),
  contractingParty: optionalTextSchema("Contratante", 200),
  quantities: optionalTextSchema("Quantitativos", 1000),
});

export async function addBidderCertificate(formData: FormData) {
  const { organizationId, userId } = await requireBiddingAccess();

  const parsed = certificateSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    contractingParty: String(formData.get("contractingParty") ?? ""),
    quantities: String(formData.get("quantities") ?? ""),
  });
  if (!parsed.success) fail(firstIssueMessage(parsed.error));
  const periodStart = parseDateInput(String(formData.get("periodStart") ?? ""));
  const periodEnd = parseDateInput(String(formData.get("periodEnd") ?? ""));
  if (periodStart === undefined) fail("Data de início inválida.");
  if (periodEnd === undefined) fail("Data de fim inválida.");
  if (periodStart && periodEnd && periodEnd < periodStart) fail("O fim do período não pode ser anterior ao início.");

  const cert = await withOrgContext(organizationId, (tx) =>
    tx.bidderCertificate.create({ data: { organizationId, ...parsed.data, periodStart, periodEnd } }),
  );
  await logSecurityEvent({ type: "licitacoes.bidder_certificate_added", actorUserId: userId, organizationId, targetId: cert.id });
  done();
}

export async function removeBidderCertificate(id: string) {
  const { organizationId, userId } = await requireBiddingAccess();

  const { count } = await withOrgContext(organizationId, (tx) => tx.bidderCertificate.deleteMany({ where: { id, organizationId } }));
  if (count === 0) fail("Atestado não encontrado.");

  await logSecurityEvent({ type: "licitacoes.bidder_certificate_removed", actorUserId: userId, organizationId, targetId: id });
  done();
}
