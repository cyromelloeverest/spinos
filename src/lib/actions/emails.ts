"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { withOrgContext } from "@/lib/db/with-org-context";
import { CampaignError, cancelCampaign, saveCampaign, startCampaign } from "@/lib/email/campaign";
import { renderCampaignHtml, renderCampaignText } from "@/lib/email/render";
import { resendProvider, safeDisplayName } from "@/lib/email/provider";
import { unsubscribeUrl } from "@/lib/email/tokens";
import { buildSignature } from "@/lib/content/checks";
import { packForKey } from "@/lib/content/generate";
import { logError } from "@/lib/log-error";

const BACK = "/emails";
const go = (qs: string): never => redirect(`${BACK}?${qs}`);
const err = (m: string, id?: string | null): never => go(`${id ? `id=${id}&` : ""}erro=${encodeURIComponent(m)}`);

async function requireManager() {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  if (!organizationId || !userId) redirect("/onboarding");
  const m = await withOrgContext(organizationId!, (tx) => tx.membership.findFirst({ where: { organizationId: organizationId!, userId: userId! }, select: { role: true } }));
  if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) err("Só donos e administradores criam e enviam campanhas.");
  return { organizationId: organizationId!, userId: userId! };
}

function inputFrom(f: FormData) {
  const get = (k: string) => String(f.get(k) ?? "");
  return { name: get("name"), subject: get("subject"), preheader: get("preheader"), body: get("body"), audience: get("audience") };
}

export async function saveCampaignAction(id: string | null, formData: FormData) {
  const { organizationId, userId } = await requireManager();
  let savedId: string;
  try {
    savedId = (await withOrgContext(organizationId, (tx) => saveCampaign(tx, organizationId, userId, id, inputFrom(formData)))).id;
  } catch (e) {
    if (e instanceof CampaignError) return err(e.message, id);
    throw e;
  }
  revalidatePath(BACK);
  go(`id=${savedId}&salvo=1`);
}

// Teste: o e-mail sai só para quem está logado, com o rótulo [TESTE], e não conta no limite do mês.
export async function sendTestAction(id: string, formData: FormData) {
  const { organizationId, userId } = await requireManager();
  let savedId = id;
  try {
    savedId = (await withOrgContext(organizationId, (tx) => saveCampaign(tx, organizationId, userId, id, inputFrom(formData)))).id;
    const info = await withOrgContext(organizationId, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
      const m = await tx.membership.findFirstOrThrow({ where: { organizationId, userId }, select: { user: { select: { email: true, name: true } } } });
      const installed = await tx.organizationPack.findUnique({ where: { organizationId }, select: { packKey: true } });
      const signature = buildSignature(packForKey(installed?.packKey), org);
      return { org, user: m.user, signature };
    });
    const c = inputFrom(formData);
    const place = [info.org.city, info.org.state].filter(Boolean).join("/");
    const unsub = unsubscribeUrl(organizationId, info.user.email);
    const render = { subject: c.subject, preheader: c.preheader, body: c.body, firstName: info.user.name, senderName: info.org.name, senderLines: [info.org.name, [info.org.cnpj ? `CNPJ ${info.org.cnpj}` : "", place].filter(Boolean).join(" · "), info.signature && !info.signature.warning ? info.signature.text : ""].filter(Boolean), unsubscribeUrl: unsub };
    await resendProvider.send({ from: `${safeDisplayName(info.org.name)} <envio@spinos.com.br>`, to: info.user.email, subject: `[TESTE] ${c.subject}`, html: renderCampaignHtml(render), text: renderCampaignText(render) });
  } catch (e) {
    if (e instanceof CampaignError) return err(e.message, id);
    logError("emails: falha no envio de teste", e, { organizationId });
    return err("Não foi possível enviar o teste agora.", savedId);
  }
  revalidatePath(BACK);
  go(`id=${savedId}&teste=1`);
}

export async function startCampaignAction(id: string, formData: FormData) {
  const { organizationId, userId } = await requireManager();
  if (formData.get("confirm") !== "on") return err("Marque a confirmação para enviar.", id);
  try {
    await withOrgContext(organizationId, (tx) => saveCampaign(tx, organizationId, userId, id, inputFrom(formData)));
    await withOrgContext(organizationId, (tx) => startCampaign(tx, { organizationId, userId }, id));
  } catch (e) {
    if (e instanceof CampaignError) return err(e.message, id);
    throw e;
  }
  revalidatePath(BACK);
  go(`id=${id}&enviando=1`);
}

export async function cancelCampaignAction(id: string) {
  const { organizationId } = await requireManager();
  try {
    await withOrgContext(organizationId, (tx) => cancelCampaign(tx, organizationId, id));
  } catch (e) {
    if (e instanceof CampaignError) return err(e.message, id);
    throw e;
  }
  revalidatePath(BACK);
  go(`id=${id}&cancelado=1`);
}
