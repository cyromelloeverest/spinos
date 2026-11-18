import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { RECIPES, readConfig, type AutomationKey } from "@/lib/automations/recipes";
import { toggleAutomation, saveAutomation } from "@/lib/actions/automations";
import { getDefaultPipeline } from "@/lib/crm/pipeline-config";
import { ACTIVITY_TYPE_LABEL, type ActivityTypeKey } from "@/lib/crm/activities";
import { formatBrasilia } from "@/lib/crm/dates";
import { logError } from "@/lib/log-error";
import { PageHeader } from "@/components/PageHeader";

const inputCls = "rounded-[10px] border px-3 text-[13px] outline-none";
const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "40px" } as const;

function Num({ name, label, value, min = 1 }: { name: string; label: string; value: number; min?: number }) {
  return (
    <label className="grid gap-1 text-[12px]">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <input type="number" name={name} defaultValue={value} min={min} className={inputCls} style={{ ...inputStyle, width: 140 }} />
    </label>
  );
}

function TypeSelect({ name, value }: { name: string; value: string }) {
  return (
    <select name={name} defaultValue={value} className={inputCls} style={inputStyle}>
      {(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityTypeKey[]).map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABEL[t]}</option>)}
    </select>
  );
}

export default async function AutomacoesPage({ searchParams }: { searchParams: Promise<{ erro?: string; salvo?: string }> }) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let data;
  try {
    data = await withOrgContext(organizationId, async (tx) => ({
      rows: await tx.automation.findMany({ where: { organizationId } }),
      members: await tx.membership.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true } } } }),
      pipeline: await getDefaultPipeline(tx, organizationId),
      runs: await tx.automationRun.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 10 }),
    }));
  } catch (err) {
    logError("automacoes: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }

  const byKey = new Map(data.rows.map((r) => [r.key, r]));
  const openStages = data.pipeline.stages.filter((s) => s.kind === "OPEN");
  const groups = ["Chegada do lead", "Durante a negociação", "Depois do fechamento"] as const;
  const on = data.rows.filter((r) => r.enabled).length;

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[1080px]">
      <PageHeader title="Automações"
        meta={<>{on} de {RECIPES.length} ligadas</>}>
        Regras prontas que fazem o funil andar sozinho: criam tarefas e distribuem leads. Elas não enviam mensagens para os seus contatos. Ligue as que fazem sentido e ajuste os prazos.
      </PageHeader>

      {params.erro && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">{params.erro}</div>}
      {params.salvo && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} role="status">Salvo.</div>}

      {groups.map((group) => (
        <section key={group} className="mb-8">
          <h2 className="text-[11px] uppercase font-medium mb-2" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>{group}</h2>
          <div className="grid gap-3">
            {RECIPES.filter((r) => r.group === group).map((r) => {
              const row = byKey.get(r.key);
              const enabled = row?.enabled ?? false;
              const key = r.key as AutomationKey;
              const cfg = readConfig(key, row?.config);
              return (
                <div key={r.key} className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-semibold">{r.title}</div>
                      <p className="text-[12.5px] leading-[1.55] m-0 mt-1" style={{ color: "var(--fg-muted)" }}>{r.description}</p>
                    </div>
                    <form action={toggleAutomation.bind(null, r.key)}>
                      <button type="submit" aria-pressed={enabled} className="text-[12px] font-semibold px-3 py-1.5 rounded-full border cursor-pointer" style={{ background: enabled ? "var(--primary)" : "transparent", borderColor: enabled ? "var(--primary)" : "var(--border-strong)", color: enabled ? "#ffffff" : "var(--fg-muted)" }}>
                        {enabled ? "Ligada" : "Desligada"}
                      </button>
                    </form>
                  </div>
                  <details className="mt-3">
                    <summary className="text-[12.5px] cursor-pointer font-semibold" style={{ color: "var(--primary)" }}>Ajustar</summary>
                    <form action={saveAutomation.bind(null, r.key)} className="grid gap-3 mt-3">
                      {key === "lead_response" && (() => { const c = readConfig("lead_response", row?.config); return (<div className="flex gap-3 flex-wrap"><Num name="slaMinutes" label="Prazo do primeiro atendimento (min)" value={c.slaMinutes} min={5} /><Num name="escalateAfterMinutes" label="Avisar a gestão depois de (min)" value={c.escalateAfterMinutes} min={5} /></div>); })()}
                      {key === "lead_distribution" && (() => { const c = readConfig("lead_distribution", row?.config); return (<div className="grid gap-1.5"><span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>Quem entra no rodízio</span>{data.members.map((m) => (<label key={m.userId} className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="userIds" value={m.userId} defaultChecked={c.userIds.includes(m.userId)} />{m.user.name || m.user.email}</label>))}</div>); })()}
                      {key === "proposal_followup" && (() => { const c = readConfig("proposal_followup", row?.config); return (<div className="grid gap-2"><div className="grid gap-1.5"><span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>Etapas de proposta</span>{openStages.map((s) => (<label key={s.key} className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="stageKeys" value={s.key} defaultChecked={c.stageKeys.includes(s.key)} />{s.name}</label>))}</div><label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Follow-ups depois de (dias, separados por vírgula)</span><input name="days" defaultValue={c.days.join(", ")} className={inputCls} style={{ ...inputStyle, width: 220 }} /></label></div>); })()}
                      {key === "no_next_step" && <Num name="afterDays" label="Avisar depois de (dias sem próximo passo)" value={(cfg as { afterDays: number }).afterDays} />}
                      {key === "lost_reactivation" && <Num name="afterDays" label="Retomar depois de (dias)" value={(cfg as { afterDays: number }).afterDays} min={7} />}
                      {key === "stage_tasks" && (() => { const c = readConfig("stage_tasks", row?.config); return (<div className="grid gap-2">{[0, 1, 2].map((i) => { const rule = c.rules[i]; return (<div key={i} className="grid gap-2 md:grid-cols-[1fr_120px_1.4fr_90px]"><select name={`stage.${i}`} defaultValue={rule?.stageKey ?? openStages[0]?.key} className={inputCls} style={inputStyle}>{openStages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select><TypeSelect name={`type.${i}`} value={rule?.task.type ?? "CALL"} /><input name={`title.${i}`} defaultValue={rule?.task.title ?? ""} placeholder="Tarefa (vazio = sem regra)" className={inputCls} style={inputStyle} /><input type="number" name={`days.${i}`} min={0} defaultValue={rule?.task.days ?? 1} className={inputCls} style={inputStyle} aria-label="Dias" /></div>); })}</div>); })()}
                      {key === "won_onboarding" && (() => { const c = readConfig("won_onboarding", row?.config); return (<div className="grid gap-2">{[0, 1, 2, 3].map((i) => { const t = c.tasks[i]; return (<div key={i} className="grid gap-2 md:grid-cols-[120px_1.6fr_90px]"><TypeSelect name={`type.${i}`} value={t?.type ?? "TASK"} /><input name={`title.${i}`} defaultValue={t?.title ?? ""} placeholder="Tarefa (vazio = sem tarefa)" className={inputCls} style={inputStyle} /><input type="number" name={`days.${i}`} min={0} defaultValue={t?.days ?? 1} className={inputCls} style={inputStyle} aria-label="Dias" /></div>); })}</div>); })()}
                      <div><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}>Salvar ajustes</button></div>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h2 className="text-[11px] uppercase font-medium mb-2" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>O que as automações fizeram</h2>
        {data.runs.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Nada ainda.</p>
        ) : (
          <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {data.runs.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <span>{RECIPES.find((x) => x.key === r.automationKey)?.title ?? r.automationKey}{r.summary ? ` · ${r.summary}` : ""}</span>
                <span style={{ color: "var(--fg-faint)" }}>{formatBrasilia(r.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
