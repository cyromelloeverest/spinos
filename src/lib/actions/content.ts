"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { withOrgContext } from "@/lib/db/with-org-context";
import { generateContent } from "@/lib/content/generate";
import { anthropicModelCall } from "@/lib/content/model";

const BACK = "/conteudo";
const go = (qs: string): never => redirect(`${BACK}?${qs}`);

async function requireOrg() {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  if (!organizationId || !userId) redirect("/onboarding");
  return { organizationId: organizationId!, userId: userId! };
}

export async function generateContentAction(formData: FormData) {
  const { organizationId, userId } = await requireOrg();
  if (!process.env.ANTHROPIC_API_KEY) go("erro=" + encodeURIComponent("A geração de conteúdo ainda não está configurada."));
  const channel = String(formData.get("channel") ?? "");
  const outcome = await generateContent(organizationId, userId, { kind: String(formData.get("kind") ?? ""), topic: String(formData.get("topic") ?? ""), channel: channel || null }, anthropicModelCall);
  revalidatePath(BACK);
  switch (outcome.status) {
    case "ok":
      return go(`gerado=${outcome.generationId}`);
    case "limit":
      return go("erro=" + encodeURIComponent(outcome.trialing ? "O período de teste inclui poucos pedidos de conteúdo e eles já foram usados. Assine um plano ou compre créditos para continuar." : "Você usou todos os pedidos de conteúdo deste mês. Compre créditos avulsos ou espere o próximo mês."));
    default:
      return go("erro=" + encodeURIComponent(outcome.message));
  }
}

// Edição do rascunho pela pessoa: título e texto. Aprovado ou descartado não volta a ser editado aqui.
export async function saveDraft(id: string, formData: FormData) {
  const { organizationId } = await requireOrg();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 20000);
  if (!title || !body) go("erro=" + encodeURIComponent("Título e texto não podem ficar vazios."));
  const res = await withOrgContext(organizationId, (tx) => tx.contentDraft.updateMany({ where: { id, organizationId, status: "DRAFT" }, data: { title, body } }));
  revalidatePath(BACK);
  if (res.count === 0) go("erro=" + encodeURIComponent("Este rascunho não pode mais ser editado."));
  go("salvo=1");
}

export async function setDraftStatus(id: string, status: "APPROVED" | "DISCARDED" | "DRAFT") {
  const { organizationId } = await requireOrg();
  await withOrgContext(organizationId, (tx) => tx.contentDraft.updateMany({ where: { id, organizationId }, data: { status } }));
  revalidatePath(BACK);
  go(status === "APPROVED" ? "aprovado=1" : "salvo=1");
}
