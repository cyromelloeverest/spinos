"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { withOrgContext } from "@/lib/db/with-org-context";
import { CONFIG_SCHEMAS, defaultConfig, isAutomationKey, readConfig, type AutomationKey } from "@/lib/automations/recipes";
import type { Prisma } from "@/generated/prisma/client";

async function requireManager() {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  if (!organizationId || !userId) redirect("/onboarding");
  const m = await withOrgContext(organizationId, (tx) => tx.membership.findFirst({ where: { organizationId, userId }, select: { role: true } }));
  if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) redirect("/automacoes?erro=" + encodeURIComponent("Só donos e administradores podem alterar as automações."));
  return { organizationId, userId };
}

const ints = (v: FormDataEntryValue | null) => Number(String(v ?? "").trim());
const intList = (v: FormDataEntryValue | null) => String(v ?? "").split(/[,;\s]+/).filter(Boolean).map(Number);

export async function toggleAutomation(key: string) {
  if (!isAutomationKey(key)) redirect("/automacoes");
  const { organizationId } = await requireManager();
  await withOrgContext(organizationId, async (tx) => {
    const current = await tx.automation.findUnique({ where: { organizationId_key: { organizationId, key } } });
    const config = (current?.config ?? defaultConfig(key)) as Prisma.InputJsonValue;
    await tx.automation.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: { enabled: !(current?.enabled ?? false) },
      create: { organizationId, key, enabled: true, config },
    });
  });
  revalidatePath("/automacoes");
  redirect("/automacoes?salvo=1");
}

// Lê o formulário de cada receita para o formato da configuração e valida com o
// mesmo esquema que o motor usa para ler.
function parseConfig(key: AutomationKey, f: FormData): unknown {
  switch (key) {
    case "lead_response":
      return { slaMinutes: ints(f.get("slaMinutes")), escalateAfterMinutes: ints(f.get("escalateAfterMinutes")) };
    case "lead_distribution":
      return { userIds: f.getAll("userIds").map(String), cursor: 0 };
    case "proposal_followup":
      return { stageKeys: f.getAll("stageKeys").map(String), days: intList(f.get("days")) };
    case "no_next_step":
      return { afterDays: ints(f.get("afterDays")) };
    case "lost_reactivation":
      return { afterDays: ints(f.get("afterDays")) };
    case "stage_tasks": {
      const rules = [];
      for (let i = 0; i < 3; i++) {
        const title = String(f.get(`title.${i}`) ?? "").trim();
        if (!title) continue;
        rules.push({ stageKey: String(f.get(`stage.${i}`) ?? ""), task: { type: String(f.get(`type.${i}`) ?? "TASK"), title, days: ints(f.get(`days.${i}`)) } });
      }
      return { rules };
    }
    case "won_onboarding": {
      const tasks = [];
      for (let i = 0; i < 4; i++) {
        const title = String(f.get(`title.${i}`) ?? "").trim();
        if (!title) continue;
        tasks.push({ type: String(f.get(`type.${i}`) ?? "TASK"), title, days: ints(f.get(`days.${i}`)) });
      }
      return { tasks };
    }
  }
}

export async function saveAutomation(key: string, formData: FormData) {
  if (!isAutomationKey(key)) redirect("/automacoes");
  const { organizationId } = await requireManager();
  const parsed = CONFIG_SCHEMAS[key].safeParse(parseConfig(key, formData));
  if (!parsed.success) redirect("/automacoes?erro=" + encodeURIComponent("Confira os valores: " + (parsed.error.issues[0]?.message ?? "inválidos") + "."));
  // Rodízio: guardar o cursor atual se a lista não mudou, para não reiniciar a fila.
  await withOrgContext(organizationId, async (tx) => {
    const current = await tx.automation.findUnique({ where: { organizationId_key: { organizationId, key } } });
    let config = parsed.data as unknown;
    if (key === "lead_distribution" && current) {
      const prev = readConfig("lead_distribution", current.config);
      const next = config as { userIds: string[]; cursor: number };
      if (JSON.stringify(prev.userIds) === JSON.stringify(next.userIds)) config = { ...next, cursor: prev.cursor };
    }
    await tx.automation.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: { config: config as Prisma.InputJsonValue },
      create: { organizationId, key, enabled: false, config: config as Prisma.InputJsonValue },
    });
  });
  revalidatePath("/automacoes");
  redirect("/automacoes?salvo=1");
}
