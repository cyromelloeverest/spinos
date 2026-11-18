import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { effectiveContentLimit } from "@/lib/trial";
import { packForKey } from "@/lib/content/generate";
import { KIND_LABEL, type ContentKindKey } from "@/lib/content/schema";
import { generateContentAction, saveDraft, setDraftStatus } from "@/lib/actions/content";
import { formatBrasilia } from "@/lib/crm/dates";
import { logError } from "@/lib/log-error";

const inputCls = "rounded-[10px] border px-3 text-[13px] outline-none w-full";
const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "40px" } as const;
const btn = { background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" } as const;
const btnGhost = { background: "transparent", borderColor: "var(--border-strong)", color: "var(--fg)" } as const;
const STATUS_LABEL = { DRAFT: "Rascunho", APPROVED: "Aprovado", DISCARDED: "Descartado" } as const;
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const asSources = (v: unknown): { label: string; url: string }[] => (Array.isArray(v) ? v.filter((x): x is { label: string; url: string } => typeof x?.url === "string" && typeof x?.label === "string") : []);

export default async function ConteudoPage({ searchParams }: { searchParams: Promise<{ erro?: string; gerado?: string; salvo?: string; aprovado?: string; ver?: string }> }) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let data;
  try {
    data = await withOrgContext(organizationId, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { plan: true, trialEndsAt: true, creditBalance: true, responsibleName: true, professionalRegistration: true } });
      const installed = await tx.organizationPack.findUnique({ where: { organizationId }, select: { packKey: true } });
      const { max, isTrialing } = effectiveContentLimit(org);
      const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const used = (await tx.contentDraft.groupBy({ by: ["generationId"], where: isTrialing ? { organizationId } : { organizationId, createdAt: { gte: since } } })).length;
      const drafts = await tx.contentDraft.findMany({ where: { organizationId, body: { not: "" }, status: params.ver === "descartados" ? "DISCARDED" : { not: "DISCARDED" } }, orderBy: { createdAt: "desc" }, take: 60 });
      return { org, packKey: installed?.packKey ?? null, max, isTrialing, used, drafts };
    });
  } catch (err) {
    logError("conteudo: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }

  const pack = packForKey(data.packKey);
  const topics = pack?.contentTopics ?? [];
  const remaining = Math.max(0, data.max - data.used);
  const needsSignature = Boolean(pack?.contentSignature) && !(data.org.responsibleName && data.org.professionalRegistration);

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[1080px]">
      <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>Conteúdo</h1>
      <p className="m-0 mb-1 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Ideias de posts, posts, artigos e textos de e-mail escritos pela IA do Spinos como <strong>rascunho</strong>. Nada é publicado sozinho: você lê, ajusta e decide.
      </p>
      <p className="m-0 mb-5 text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
        {data.isTrialing ? "No período de teste" : "Neste mês"}: {data.used} de {data.max} pedidos usados{remaining === 0 && data.org.creditBalance > 0 ? `; os próximos usam 1 crédito cada (saldo: ${data.org.creditBalance})` : ""}.
      </p>

      {params.erro && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">{params.erro}</div>}
      {(params.gerado || params.salvo || params.aprovado) && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} role="status">{params.gerado ? "Rascunho pronto. Leia com atenção e confira os pontos marcados antes de usar." : params.aprovado ? "Marcado como aprovado." : "Salvo."}</div>}
      {needsSignature && (
        <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Informe o responsável técnico e o registro profissional no <a href="/settings/empresa" style={{ textDecoration: "underline" }}>Perfil da empresa</a>: são obrigatórios na assinatura do material de divulgação do seu segmento.
        </div>
      )}

      <form action={generateContentAction} className="rounded-[16px] border p-5 grid gap-3 mb-8" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>O que você quer</span>
            <select name="kind" className={inputCls} style={inputStyle} defaultValue="SOCIAL_POST">{(Object.keys(KIND_LABEL) as ContentKindKey[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Canal (para posts)</span>
            <select name="channel" className={inputCls} style={inputStyle} defaultValue=""><option value="">Sem canal específico</option><option value="INSTAGRAM">Instagram</option><option value="LINKEDIN">LinkedIn</option></select>
          </label>
        </div>
        <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Assunto</span>
          <input name="topic" required minLength={3} maxLength={300} list="topics" placeholder="Ex.: o que muda para empresas com a reforma tributária" className={inputCls} style={inputStyle} />
          <datalist id="topics">{topics.map((t) => <option key={t.title} value={t.title} />)}</datalist>
          {topics.length > 0 && <span style={{ color: "var(--fg-faint)" }}>Sugestões do seu segmento aparecem ao digitar.</span>}
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" className="text-[13px] font-semibold px-4 py-2.5 rounded-[10px] border cursor-pointer" style={btn}>Gerar rascunho</button>
          <span className="text-[12px]" style={{ color: "var(--fg-faint)" }}>Leva de 20 a 60 segundos. Cada pedido conta como um uso.</span>
        </div>
      </form>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] uppercase font-medium m-0" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>{params.ver === "descartados" ? "Descartados" : "Seus rascunhos"}</h2>
        <a href={params.ver === "descartados" ? "/conteudo" : "/conteudo?ver=descartados"} className="text-[12px]" style={{ color: "var(--primary)" }}>{params.ver === "descartados" ? "Ver rascunhos" : "Ver descartados"}</a>
      </div>
      {data.drafts.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Nada por aqui ainda. Peça um rascunho acima.</p>
      ) : (
        <div className="grid gap-3">
          {data.drafts.map((d) => {
            const warnings = asStrings(d.warnings);
            const verify = asStrings(d.toVerify);
            const sources = asSources(d.sources);
            const open = params.gerado === d.generationId;
            return (
              <details key={d.id} open={open} className="rounded-[16px] border p-4" style={{ borderColor: warnings.length ? "var(--warn)" : "var(--border)", background: "var(--card)" }}>
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                  <span>
                    <span className="text-[14px] font-semibold">{d.title}</span>
                    <span className="block text-[12px] mt-0.5" style={{ color: "var(--fg-faint)" }}>{KIND_LABEL[d.kind as ContentKindKey]} · {STATUS_LABEL[d.status]} · {formatBrasilia(d.createdAt)}{warnings.length ? ` · ${warnings.length} aviso${warnings.length > 1 ? "s" : ""}` : ""}</span>
                  </span>
                </summary>
                <div className="mt-3 grid gap-3">
                  {warnings.length > 0 && (
                    <div className="rounded-[10px] border px-3 py-2 text-[12.5px] grid gap-1" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
                      <strong>Revise antes de usar</strong>
                      {warnings.map((w) => <span key={w}>• {w}</span>)}
                    </div>
                  )}
                  {verify.length > 0 && (
                    <div className="text-[12.5px] grid gap-0.5" style={{ color: "var(--fg-muted)" }}>
                      <strong>Confira na fonte oficial</strong>
                      {verify.map((v) => <span key={v}>• {v}</span>)}
                    </div>
                  )}
                  {d.status === "DRAFT" ? (
                    <form action={saveDraft.bind(null, d.id)} className="grid gap-2">
                      <input name="title" defaultValue={d.title} maxLength={200} className={inputCls} style={inputStyle} aria-label="Título" />
                      <textarea name="body" defaultValue={d.body} rows={Math.min(22, Math.max(6, d.body.split("\n").length + 2))} className="rounded-[10px] border px-3 py-2 text-[13px] outline-none w-full" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", lineHeight: 1.55 }} aria-label="Texto" />
                      <div><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btnGhost}>Salvar edição</button></div>
                    </form>
                  ) : (
                    <pre className="m-0 text-[13px] whitespace-pre-wrap" style={{ fontFamily: "inherit", lineHeight: 1.55 }}>{d.body}</pre>
                  )}
                  {sources.length > 0 && (
                    <div className="text-[12px] grid gap-0.5" style={{ color: "var(--fg-muted)" }}>
                      <strong>Fontes citadas</strong>
                      {sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{s.label}</a>)}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {d.status === "DRAFT" && <form action={setDraftStatus.bind(null, d.id, "APPROVED")}><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btn}>Marcar como aprovado</button></form>}
                    {d.status !== "DISCARDED" && <form action={setDraftStatus.bind(null, d.id, "DISCARDED")}><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btnGhost}>Descartar</button></form>}
                    {d.status === "DISCARDED" && <form action={setDraftStatus.bind(null, d.id, "DRAFT")}><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btnGhost}>Restaurar</button></form>}
                  </div>
                  <p className="m-0 text-[11.5px]" style={{ color: "var(--fg-faint)" }}>Aprovar só marca o texto como revisado por você: o Spinos não publica nada. Quem responde pelo conteúdo é o profissional.</p>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
