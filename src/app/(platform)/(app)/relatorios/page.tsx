import Link from "next/link";
import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { marketingReport, parsePeriodKey, PERIOD_LABEL, resolvePeriod, siteTraffic, type PeriodKey } from "@/lib/reports/marketing";
import { SPEND_CHANNELS } from "@/lib/reports/spend";
import { addSpendEntry, importSpendEntries, removeSpendEntry } from "@/lib/actions/spend";
import { formatBRL } from "@/lib/crm/money";
import { formatBrasilia } from "@/lib/crm/dates";
import { logError } from "@/lib/log-error";

const inputCls = "rounded-[10px] border px-3 text-[13px] outline-none w-full";
const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "40px" } as const;
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const minutes = (n: number | null) => (n == null ? "—" : n < 60 ? `${Math.round(n)} min` : n < 1440 ? `${(n / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : `${(n / 1440).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`);
const num = (n: number) => n.toLocaleString("pt-BR");

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>{label}</div>
      <div className="text-[22px] font-medium mt-1" style={{ fontFamily: "var(--font-display)" }}>{value}</div>
      {hint && <div className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-faint)" }}>{hint}</div>}
    </div>
  );
}

function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="text-[11px] uppercase font-medium mb-2" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>{children}</h2>;
}

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ periodo?: string; erro?: string; salvo?: string; info?: string }> }) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");
  const periodKey = parsePeriodKey(params.periodo);
  const period = resolvePeriod(periodKey);

  let data;
  try {
    data = await withOrgContext(organizationId, async (tx) => ({
      report: await marketingReport(tx, organizationId, period),
      site: await siteTraffic(tx, organizationId, period),
    }));
  } catch (err) {
    logError("relatorios: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }
  const { report, site } = data;
  const t = report.totals;

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[1080px]">
      <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>Relatórios</h1>
      <p className="m-0 mb-4 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        De onde vêm os clientes e quanto custa conquistá-los: da origem do lead até o contrato fechado.
      </p>

      <div className="flex gap-2 flex-wrap mb-6" role="tablist" aria-label="Período">
        {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((k) => (
          <Link key={k} href={`/relatorios?periodo=${k}`} role="tab" aria-selected={k === periodKey} className="text-[12.5px] font-semibold px-3 py-1.5 rounded-full border no-underline" style={{ background: k === periodKey ? "var(--primary)" : "transparent", borderColor: k === periodKey ? "var(--primary)" : "var(--border-strong)", color: k === periodKey ? "#ffffff" : "var(--fg-muted)" }}>
            {PERIOD_LABEL[k]}
          </Link>
        ))}
      </div>

      {params.erro && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">{params.erro}</div>}
      {(params.salvo || params.info) && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} role="status">{params.info ?? "Salvo."}</div>}

      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-8">
        <Kpi label="Leads novos" value={num(t.leads)} hint={`${num(t.open)} em andamento`} />
        <Kpi label="Clientes ganhos" value={num(t.won)} hint={`${num(t.lost)} perdidos`} />
        <Kpi label="Conversão" value={pct(t.conversion)} hint="ganhos sobre leads do período" />
        <Kpi label="Valor ganho" value={formatBRL(t.wonValueBRL)} />
        <Kpi label="Investimento lançado" value={t.spendBRL > 0 ? formatBRL(t.spendBRL) : "—"} hint={t.spendBRL > 0 ? undefined : "lance abaixo para calcular o custo"} />
        <Kpi label="Custo por cliente" value={t.cacBRL == null ? "—" : formatBRL(t.cacBRL)} hint="investimento sobre clientes ganhos" />
      </section>

      <section className="mb-8">
        <H2>Por origem</H2>
        {report.channels.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Nenhum lead no período.</p>
        ) : (
          <div className="rounded-[12px] border overflow-x-auto" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ color: "var(--fg-faint)", textAlign: "right" }}>
                  {["Origem", "Leads", "Em andamento", "Ganhos", "Perdidos", "Conversão", "Valor ganho", "Investimento", "Custo por lead", "Custo por cliente"].map((h, i) => (
                    <th key={h} className="font-medium px-3 py-2" style={{ textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.channels.map((c) => (
                  <tr key={c.channel} style={{ borderTop: "1px solid var(--border)", textAlign: "right" }}>
                    <td className="px-3 py-2 font-semibold" style={{ textAlign: "left" }}>{c.label}</td>
                    <td className="px-3 py-2">{num(c.leads)}</td>
                    <td className="px-3 py-2">{num(c.open)}</td>
                    <td className="px-3 py-2">{num(c.won)}</td>
                    <td className="px-3 py-2">{num(c.lost)}</td>
                    <td className="px-3 py-2">{pct(c.conversion)}</td>
                    <td className="px-3 py-2">{c.wonValueBRL > 0 ? formatBRL(c.wonValueBRL) : "—"}</td>
                    <td className="px-3 py-2">{c.spendBRL > 0 ? formatBRL(c.spendBRL) : "—"}</td>
                    <td className="px-3 py-2">{formatBRL(c.costPerLeadBRL)}</td>
                    <td className="px-3 py-2">{formatBRL(c.cacBRL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="m-0 mt-2 text-[11.5px]" style={{ color: "var(--fg-faint)" }}>A origem é a do primeiro contato da empresa com você. O investimento vem dos lançamentos abaixo.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 mb-8">
        <div>
          <H2>Atendimento</H2>
          <div className="rounded-[12px] border p-4 text-[13px] grid gap-1.5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="flex justify-between"><span style={{ color: "var(--fg-muted)" }}>Tempo mediano até o primeiro atendimento</span><strong>{minutes(report.response.medianMinutes)}</strong></div>
            <div className="flex justify-between"><span style={{ color: "var(--fg-muted)" }}>Leads já atendidos</span><strong>{num(report.response.answered)}</strong></div>
            <div className="flex justify-between"><span style={{ color: "var(--fg-muted)" }}>Em aberto sem atendimento</span><strong>{num(report.response.unanswered)}</strong></div>
          </div>
        </div>
        <div>
          <H2>Por que perdemos</H2>
          <div className="rounded-[12px] border p-4 text-[13px] grid gap-1.5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {report.lossReasons.length === 0 ? <span style={{ color: "var(--fg-muted)" }}>Nenhuma negociação perdida no período.</span> : report.lossReasons.map((r) => (
              <div key={r.label} className="flex justify-between"><span>{r.label}</span><strong>{num(r.count)}</strong></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <H2>Site e páginas de captação</H2>
        {!site.hasSite ? (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Você ainda não tem site no Spinos. <Link href="/meu-site" style={{ color: "var(--primary)" }}>Criar meu site</Link> para ver visitas, cliques e envios aqui.</p>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-3">
              <Kpi label="Visitantes" value={num(site.visitors)} hint={`${num(site.views)} páginas vistas`} />
              <Kpi label="Cliques no WhatsApp" value={num(site.whatsappClicks)} hint={`${num(site.phoneClicks)} no telefone`} />
              <Kpi label="Formulários enviados" value={num(site.forms)} />
              <Kpi label="Visitantes que enviaram" value={pct(site.formRate)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[12px] border p-4 text-[13px] grid gap-1.5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <div className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>Páginas mais vistas</div>
                {site.topPages.length === 0 ? <span style={{ color: "var(--fg-muted)" }}>Sem visitas no período.</span> : site.topPages.map((p) => <div key={p.path} className="flex justify-between"><span>{p.path}</span><strong>{num(p.views)}</strong></div>)}
              </div>
              <div className="rounded-[12px] border p-4 text-[13px] grid gap-1.5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <div className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>De onde vêm os visitantes</div>
                {site.topSources.length === 0 ? <span style={{ color: "var(--fg-muted)" }}>Sem visitas no período.</span> : site.topSources.map((s) => <div key={s.source} className="flex justify-between"><span>{s.source}</span><strong>{num(s.visitors)}</strong></div>)}
              </div>
            </div>
            <p className="m-0 mt-2 text-[11.5px]" style={{ color: "var(--fg-faint)" }}>Contagem própria, sem cookie e sem guardar dados pessoais. Não inclui visitas de quem bloqueia scripts.</p>
          </>
        )}
      </section>

      <section id="investimento" className="mb-4">
        <H2>Investimento em marketing</H2>
        <p className="m-0 mb-3 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          Nesta versão o Spinos não se conecta ao Google Ads nem à Meta: lance aqui o que você investiu (ou importe um CSV do gerenciador de anúncios) para calcular o custo por lead e por cliente.
        </p>
        <form action={addSpendEntry} className="rounded-[16px] border p-4 grid gap-3 md:grid-cols-[1.4fr_1fr_130px_130px_auto] items-end" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Descrição</span><input name="name" required placeholder="Google Ads de novembro" className={inputCls} style={inputStyle} /></label>
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Canal</span>
            <select name="channel" className={inputCls} style={inputStyle} defaultValue="google_ads">{SPEND_CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Valor (R$)</span><input name="amount" required inputMode="decimal" placeholder="1.500,00" className={inputCls} style={inputStyle} /></label>
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Data</span><input name="date" placeholder="dd/mm/aaaa" className={inputCls} style={inputStyle} /></label>
          <button type="submit" className="text-[12.5px] font-semibold px-3.5 rounded-[10px] border cursor-pointer" style={{ height: 40, background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}>Lançar</button>
        </form>

        <details className="mt-3 rounded-[12px] border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <summary className="text-[12.5px] cursor-pointer font-semibold" style={{ color: "var(--primary)" }}>Importar CSV</summary>
          <form action={importSpendEntries} className="grid gap-3 mt-3">
            <p className="m-0 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>Uma linha por lançamento: <code>data;canal;valor;descrição</code>, por exemplo <code>16/11/2026;google_ads;1500,00;Pesquisa</code>. Canais: {SPEND_CHANNELS.map((c) => c.key).join(", ")}.</p>
            <input type="file" name="file" accept=".csv,text/csv,text/plain" className="text-[12.5px]" />
            <textarea name="csv" rows={4} placeholder="…ou cole as linhas aqui" className="rounded-[10px] border px-3 py-2 text-[13px] outline-none w-full" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }} />
            <div><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={{ background: "transparent", borderColor: "var(--border-strong)", color: "var(--fg)" }}>Importar</button></div>
          </form>
        </details>

        {report.campaigns.length > 0 && (
          <div className="mt-3 rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {report.campaigns.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <span>{c.name} <span style={{ color: "var(--fg-faint)" }}>· {c.label}{c.startsAt ? ` · ${formatBrasilia(c.startsAt).slice(0, 10)}` : ""}</span></span>
                <span className="flex items-center gap-3">
                  <strong>{formatBRL(c.spendBRL)}</strong>
                  <form action={removeSpendEntry.bind(null, c.id)}><button type="submit" className="text-[12px] cursor-pointer border-0 bg-transparent" style={{ color: "var(--fg-faint)" }}>Remover</button></form>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
