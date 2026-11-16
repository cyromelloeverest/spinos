"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { withOrgContext } from "@/lib/db/with-org-context";
import { addSpend, deleteSpend, importSpendCsv, SpendError } from "@/lib/reports/spend";

const BACK = "/relatorios";
const go = (qs: string): never => redirect(`${BACK}?${qs}#investimento`);

async function requireManager(): Promise<string> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  if (!organizationId || !userId) redirect("/onboarding");
  const m = await withOrgContext(organizationId!, (tx) => tx.membership.findFirst({ where: { organizationId: organizationId!, userId: userId! }, select: { role: true } }));
  if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) go("erro=" + encodeURIComponent("Só donos e administradores lançam investimento."));
  return organizationId!;
}

export async function addSpendEntry(formData: FormData) {
  const organizationId = await requireManager();
  const get = (k: string) => String(formData.get(k) ?? "");
  try {
    await withOrgContext(organizationId, (tx) => addSpend(tx, organizationId, { name: get("name"), channel: get("channel"), amount: get("amount"), date: get("date") }));
  } catch (e) {
    if (e instanceof SpendError) go("erro=" + encodeURIComponent(e.message));
    throw e;
  }
  revalidatePath(BACK);
  go("salvo=1&periodo=ano");
}

export async function importSpendEntries(formData: FormData) {
  const organizationId = await requireManager();
  const file = formData.get("file");
  // O tamanho é conferido antes de ler o arquivo para a memória.
  if (file instanceof File && file.size > 200_000) go("erro=" + encodeURIComponent("Arquivo grande demais (máximo 200 KB)."));
  const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "");
  if (text.length > 200_000) go("erro=" + encodeURIComponent("Arquivo grande demais (máximo 200 KB)."));
  const result = await withOrgContext(organizationId, (tx) => importSpendCsv(tx, organizationId, text));
  revalidatePath(BACK);
  const msg = result.problems.length ? `${result.imported} lançamentos importados. Problemas: ${result.problems.join(" | ")}` : `${result.imported} lançamentos importados.`;
  go((result.problems.length ? "erro=" : "info=") + encodeURIComponent(msg) + "&periodo=ano");
}

export async function removeSpendEntry(id: string) {
  const organizationId = await requireManager();
  await withOrgContext(organizationId, (tx) => deleteSpend(tx, organizationId, id));
  revalidatePath(BACK);
  go("salvo=1&periodo=ano");
}
