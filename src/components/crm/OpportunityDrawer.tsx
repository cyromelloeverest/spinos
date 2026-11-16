import Link from "next/link";
import { X } from "lucide-react";
import type { DrawerData } from "@/lib/crm/drawer-data";
import { ACTIVITY_TYPE_LABEL, type ActivityTypeKey } from "@/lib/crm/activities";
import { ORIGIN_OPTIONS } from "@/lib/crm/origin-options";
import { toWhatsAppUrl, toTelUrl } from "@/lib/crm/whatsapp";
import { formatBRL } from "@/lib/crm/money";
import { formatBrasilia, toBrasiliaInput } from "@/lib/crm/dates";
import { startDeal, saveDetails, addStep, finishStep, moveStep, dropStep, winDeal, loseDeal, moveStage } from "@/lib/actions/crm";

const input = "rounded-[10px] border px-3 text-[13px] outline-none w-full";
const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "40px" } as const;
const btn = "text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11.5px] font-medium" style={{ color: "var(--fg-muted)" }}>{children}</span>;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-6 py-5" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13.5px] font-semibold m-0">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TypeSelect({ name, defaultValue = "CALL" }: { name: string; defaultValue?: string }) {
  return (
    <select name={name} defaultValue={defaultValue} className={input} style={inputStyle}>
      {(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityTypeKey[]).map((t) => (
        <option key={t} value={t}>{ACTIVITY_TYPE_LABEL[t]}</option>
      ))}
    </select>
  );
}

export function OpportunityDrawer({ data, messages, scoreId, ownerParam, erro, salvo, now }: { data: DrawerData; messages: { key: string; title: string; channel: string; text: string; url: string | null }[]; scoreId: string; ownerParam: "me" | "all"; erro?: string; salvo?: boolean; now: Date }) {
  const { company, deal, contacts, stages, members, owner } = data;
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
  const whatsapp = toWhatsAppUrl(primary?.phone);
  const tel = toTelUrl(primary?.phone);
  const close = `/pipeline?owner=${ownerParam}`;

  const openSteps = deal?.activities.filter((a) => a.status === "OPEN") ?? [];
  const doneSteps = deal?.activities.filter((a) => a.status === "DONE").slice(-5).reverse() ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link href={close} aria-label="Fechar" className="flex-1" style={{ background: "rgba(15,23,42,0.45)" }} />
      <aside className="w-full max-w-[480px] h-full overflow-y-auto" style={{ background: "var(--card)", boxShadow: "-8px 0 24px rgba(15,23,42,0.18)" }} aria-label={`Oportunidade ${company.name}`}>
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--fg-muted)" }}>
              <span className="rounded-full px-2.5 py-[3px] font-semibold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                {deal?.stage.name ?? "Oportunidade"}
              </span>
              {owner && <span>{owner.name || owner.email}</span>}
            </div>
            <Link href={close} aria-label="Fechar" className="p-1" style={{ color: "var(--fg-muted)" }}>
              <X size={18} strokeWidth={1.75} />
            </Link>
          </div>
          <h2 className="text-[20px] font-medium m-0 mt-2" style={{ fontFamily: "var(--font-display)" }}>{company.name}</h2>
          <div className="text-[12.5px] mt-1" style={{ color: "var(--fg-muted)" }}>
            {[company.city, company.state].filter(Boolean).join(", ")}
          </div>
          <div className="text-[13px] mt-2">
            {primary ? (
              <>
                <strong>{primary.name}</strong>
                {primary.jobTitle ? ` · ${primary.jobTitle}` : ""}
                {primary.phone ? <div style={{ color: "var(--fg-muted)" }}>{primary.phone}</div> : null}
              </>
            ) : (
              <span style={{ color: "var(--fg-faint)" }}>Sem contato cadastrado.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className={`${btn} no-underline`} style={{ background: "var(--good)", borderColor: "var(--good)", color: "#ffffff" }}>WhatsApp</a>}
            {tel && <a href={tel} className={`${btn} no-underline`} style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}>Ligar</a>}
            {data.scoreId && <Link href={`/company/${data.scoreId}`} className={`${btn} no-underline`} style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}>Ficha e análise</Link>}
          </div>
        </div>

        {erro && <div className="mx-6 mb-3 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">{erro}</div>}
        {salvo && !erro && <div className="mx-6 mb-3 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} role="status">Salvo.</div>}

        {messages.length > 0 && (
          <Section title="Mensagens prontas">
            <div className="grid gap-2">
              {messages.map((m) => (
                <details key={m.key} className="rounded-[12px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
                  <summary className="text-[12.5px] font-semibold cursor-pointer">{m.title}</summary>
                  <textarea readOnly rows={5} defaultValue={m.text} className="w-full mt-2 rounded-[10px] border px-3 py-2 text-[12.5px]" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }} />
                  <div className="flex items-center gap-3 mt-2 text-[12px]">
                    {m.url ? (
                      <a href={m.url} target="_blank" rel="noreferrer" className="no-underline font-semibold" style={{ color: "var(--good)" }}>Abrir no WhatsApp com esta mensagem</a>
                    ) : (
                      <span style={{ color: "var(--fg-faint)" }}>{m.channel === "WHATSAPP" ? "Sem telefone no contato." : "Copie o texto acima."}</span>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </Section>
        )}

        {!deal ? (
          <Section title="Negociação">
            <p className="text-[13px] mt-0 mb-3" style={{ color: "var(--fg-muted)" }}>Essa oportunidade ainda não está no CRM.</p>
            <form action={startDeal.bind(null, scoreId)}>
              <input type="hidden" name="owner" value={ownerParam} />
              <button type="submit" className={btn} style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}>Mover para o CRM</button>
            </form>
          </Section>
        ) : (
          <>
            <Section title="Negociação">
              <form action={saveDetails.bind(null, scoreId)} className="grid gap-3">
                <input type="hidden" name="owner" value={ownerParam} />
                <div className="grid grid-cols-2 gap-1 rounded-[10px] p-1" style={{ background: "var(--card-hover)" }}>
                  {(["ONE_TIME", "RECURRING"] as const).map((b) => (
                    <label key={b} className="text-center text-[12.5px] font-semibold rounded-[8px] py-2 cursor-pointer" style={{ background: deal.billing === b ? "var(--card)" : "transparent" }}>
                      <input type="radio" name="billing" value={b} defaultChecked={deal.billing === b} className="sr-only" />
                      {b === "ONE_TIME" ? "Venda única" : "Recorrente (mensal)"}
                    </label>
                  ))}
                </div>
                <label className="grid gap-1">
                  <Label>Valor previsto (R$)</Label>
                  <input name="expectedValue" defaultValue={deal.expectedValueBRL != null ? String(deal.expectedValueBRL).replace(".", ",") : ""} placeholder="0,00" className={input} style={inputStyle} />
                </label>
                <label className="grid gap-1">
                  <Label>Responsável</Label>
                  <select name="ownerUserId" defaultValue={deal.ownerUserId ?? ""} className={input} style={inputStyle}>
                    <option value="">Sem responsável</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <Label>Origem do lead</Label>
                  <select name="origin" defaultValue={data.originChannel ?? ""} className={input} style={inputStyle}>
                    <option value="">Não informada</option>
                    {ORIGIN_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </label>
                <div><button type="submit" className={btn} style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}>Salvar</button></div>
              </form>

              <form action={moveStage.bind(null, scoreId)} className="flex items-end gap-2 mt-4">
                <input type="hidden" name="owner" value={ownerParam} />
                <label className="grid gap-1 flex-1">
                  <Label>Etapa</Label>
                  <select name="stage" defaultValue={deal.stage.key} className={input} style={inputStyle}>
                    {stages.filter((s) => s.kind === "OPEN").map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                    {deal.stage.kind !== "OPEN" && <option value={deal.stage.key}>{deal.stage.name}</option>}
                  </select>
                </label>
                <button type="submit" className={btn} style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}>Mover</button>
              </form>

              {deal.status === "OPEN" && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <form action={winDeal.bind(null, scoreId)}>
                    <input type="hidden" name="owner" value={ownerParam} />
                    <button type="submit" className={`${btn} w-full`} style={{ background: "var(--good)", borderColor: "var(--good)", color: "#ffffff" }}>Ganha</button>
                  </form>
                  <details className="relative">
                    <summary className={`${btn} text-center list-none`} style={{ background: "var(--card)", borderColor: "var(--critical)", color: "var(--critical)" }}>Perdida</summary>
                    <form action={loseDeal.bind(null, scoreId)} className="absolute right-0 left-0 mt-2 p-3 rounded-[12px] border grid gap-2 z-10" style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
                      <input type="hidden" name="owner" value={ownerParam} />
                      <select name="reason" required defaultValue="" className={input} style={inputStyle}>
                        <option value="" disabled>Motivo da perda</option>
                        <option value="NOT_INTERESTED">Não teve interesse</option>
                        <option value="WRONG_FIT">Fora do perfil ideal</option>
                        <option value="NO_RESPONSE">Sem resposta</option>
                      </select>
                      <textarea name="notes" rows={2} placeholder="Detalhe opcional" className="rounded-[10px] border px-3 py-2 text-[13px]" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }} />
                      <button type="submit" className={btn} style={{ background: "var(--critical)", borderColor: "var(--critical)", color: "#ffffff" }}>Marcar como perdida</button>
                    </form>
                  </details>
                </div>
              )}
              {deal.status === "LOST" && deal.lossNote && <p className="text-[12.5px] mt-3 mb-0" style={{ color: "var(--fg-muted)" }}>Motivo: {deal.lossNote}</p>}
              {deal.status === "WON" && <p className="text-[12.5px] mt-3 mb-0" style={{ color: "var(--good)" }}>Ganha por {formatBRL(deal.wonValueBRL)}.</p>}
            </Section>

            <Section title="Próximos passos">
              {openSteps.length === 0 && <p className="text-[13px] mt-0 mb-3" style={{ color: "var(--fg-muted)" }}>Nenhuma atividade agendada. Defina o próximo passo para não esquecer.</p>}
              <div className="grid gap-2">
                {openSteps.map((a) => {
                  const late = a.dueAt && a.dueAt < now;
                  return (
                    <div key={a.id} className="rounded-[12px] border p-3" style={{ borderColor: late ? "var(--critical)" : "var(--border)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[13px] font-medium">{a.title}</div>
                          <div className="text-[11.5px]" style={{ color: late ? "var(--critical)" : "var(--fg-muted)" }}>
                            {ACTIVITY_TYPE_LABEL[a.type]} · {formatBrasilia(a.dueAt)}{late ? " · atrasada" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-[12px]">
                        <details className="w-full">
                          <summary className="cursor-pointer font-semibold" style={{ color: "var(--primary)" }}>Concluir</summary>
                          <form action={finishStep.bind(null, scoreId, a.id)} className="grid gap-2 mt-2">
                            <input type="hidden" name="owner" value={ownerParam} />
                            <textarea name="outcome" rows={2} placeholder="Como foi?" className="rounded-[10px] border px-3 py-2 text-[13px]" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }} />
                            <div className="text-[11.5px] font-medium" style={{ color: "var(--fg-muted)" }}>Próximo passo</div>
                            <div className="grid grid-cols-2 gap-2">
                              <TypeSelect name="next.type" />
                              <input type="datetime-local" name="next.dueAt" className={input} style={inputStyle} />
                            </div>
                            <input name="next.title" placeholder="O que fazer em seguida" className={input} style={inputStyle} />
                            <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--fg-muted)" }}>
                              <input type="checkbox" name="allowNoNext" /> Não há próximo passo
                            </label>
                            <button type="submit" className={btn} style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}>Concluir</button>
                          </form>
                        </details>
                        <details>
                          <summary className="cursor-pointer" style={{ color: "var(--fg-muted)" }}>Reagendar</summary>
                          <form action={moveStep.bind(null, scoreId, a.id)} className="flex gap-2 mt-2">
                            <input type="hidden" name="owner" value={ownerParam} />
                            <input type="datetime-local" name="dueAt" defaultValue={toBrasiliaInput(a.dueAt)} className={input} style={inputStyle} />
                            <button type="submit" className={btn} style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}>Salvar</button>
                          </form>
                        </details>
                        <form action={dropStep.bind(null, scoreId, a.id)}>
                          <input type="hidden" name="owner" value={ownerParam} />
                          <button type="submit" className="cursor-pointer border-0 bg-transparent p-0 text-[12px]" style={{ color: "var(--fg-faint)" }}>Cancelar</button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>

              <details className="mt-3" open={openSteps.length === 0 && deal.status === "OPEN"}>
                <summary className={`${btn} inline-block list-none`} style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}>Agendar</summary>
                <form action={addStep.bind(null, scoreId)} className="grid gap-2 mt-3">
                  <input type="hidden" name="owner" value={ownerParam} />
                  <div className="grid grid-cols-2 gap-2">
                    <TypeSelect name="type" />
                    <input type="datetime-local" name="dueAt" className={input} style={inputStyle} />
                  </div>
                  <input name="title" placeholder="O que fazer (ex.: ligar para o decisor)" className={input} style={inputStyle} />
                  <textarea name="notes" rows={2} placeholder="Observações (opcional)" className="rounded-[10px] border px-3 py-2 text-[13px]" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }} />
                  <div><button type="submit" className={btn} style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}>Agendar passo</button></div>
                </form>
              </details>
            </Section>

            <Section title="Histórico">
              <div className="grid gap-2 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
                {doneSteps.map((a) => (
                  <div key={a.id}><strong style={{ color: "var(--fg)" }}>{a.title}</strong> · {ACTIVITY_TYPE_LABEL[a.type]} · {formatBrasilia(a.doneAt)}{a.outcome ? ` — ${a.outcome}` : ""}</div>
                ))}
                {deal.stageEvents.map((e) => (
                  <div key={e.id}>Etapa: <strong style={{ color: "var(--fg)" }}>{e.toStage.name}</strong> · {formatBrasilia(e.createdAt)}</div>
                ))}
                {doneSteps.length === 0 && deal.stageEvents.length === 0 && <div>Sem histórico ainda.</div>}
              </div>
            </Section>
          </>
        )}
      </aside>
    </div>
  );
}
