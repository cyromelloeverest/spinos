import Link from "next/link";
import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { AUDIENCES, resolveAudience } from "@/lib/email/campaign";
import { previewCampaign } from "@/lib/email/campaign";
import { getPlan } from "@/lib/plans";
import { cancelCampaignAction, saveCampaignAction, sendTestAction, startCampaignAction } from "@/lib/actions/emails";
import { formatBrasilia } from "@/lib/crm/dates";
import { logError } from "@/lib/log-error";

const inputCls = "rounded-[10px] border px-3 text-[13px] outline-none w-full";
const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "40px" } as const;
const btn = { background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" } as const;
const btnGhost = { background: "transparent", borderColor: "var(--border-strong)", color: "var(--fg)" } as const;
const STATUS = { DRAFT: "Rascunho", SENDING: "Enviando", SENT: "Enviada", CANCELED: "Cancelada" } as const;

type Search = { id?: string; novo?: string; de?: string; erro?: string; salvo?: string; teste?: string; enviando?: string; cancelado?: string };

export default async function EmailsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const p = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let data;
  try {
    data = await withOrgContext(organizationId, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { plan: true, trialEndsAt: true } });
      const campaigns = await tx.emailCampaign.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 30 });
      const counts = await tx.emailMessage.groupBy({ by: ["campaignId", "status"], where: { organizationId, campaignId: { in: campaigns.map((c) => c.id) } }, _count: { _all: true } });
      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const usedThisMonth = await tx.emailMessage.count({ where: { organizationId, createdAt: { gte: monthStart }, status: { not: "FAILED" } } });
      const suppressed = await tx.emailSuppression.count({ where: { organizationId } });
      const audiences = await Promise.all(AUDIENCES.map(async (a) => ({ ...a, count: (await resolveAudience(tx, organizationId, a.key)).recipients.length })));
      const selected = p.id ? await tx.emailCampaign.findFirst({ where: { id: p.id, organizationId } }) : null;
      const preview = selected && selected.status === "DRAFT" ? await previewCampaign(tx, organizationId, selected.id) : null;
      const fromDraft = p.de ? await tx.contentDraft.findFirst({ where: { id: p.de, organizationId, kind: "EMAIL", status: "APPROVED" } }) : null;
      const approvedEmails = await tx.contentDraft.findMany({ where: { organizationId, kind: "EMAIL", status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, title: true } });
      return { org, campaigns, counts, usedThisMonth, suppressed, audiences, selected, preview, fromDraft, approvedEmails };
    });
  } catch (err) {
    logError("emails: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }

  const trialing = data.org.trialEndsAt !== null;
  const cap = getPlan(data.org.plan).maxEmailsPerMonth;
  const progress = (id: string) => {
    const rows = data.counts.filter((c) => c.campaignId === id);
    const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
    return { sent: n("SENT"), queued: n("QUEUED"), failed: n("FAILED") + n("BOUNCED") + n("COMPLAINED") };
  };
  const editing = data.selected?.status === "DRAFT" ? data.selected : null;
  const formOpen = Boolean(editing || p.novo || data.fromDraft);
  const seed = editing ?? (data.fromDraft ? { id: null, name: data.fromDraft.title, subject: data.fromDraft.title, preheader: "", body: data.fromDraft.body, audience: "clientes" } : { id: null, name: "", subject: "", preheader: "", body: "", audience: "clientes" });

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[880px]">
      <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>E-mails</h1>
      <p className="m-0 mb-1 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Campanhas para quem já é seu cliente ou autorizou o contato. O Spinos só envia para contatos com <strong>consentimento ou contrato</strong> registrado no CRM, e todo e-mail leva o link para sair da lista.
      </p>
      <p className="m-0 mb-5 text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
        {trialing ? "No período de teste você pode enviar e-mails de teste para você mesmo; campanhas para contatos reais começam com a assinatura." : `Neste mês: ${data.usedThisMonth} de ${cap} e-mails.`} {data.suppressed > 0 ? `${data.suppressed} endereço(s) não recebem mais (descadastro, erro de entrega ou reclamação).` : ""}
      </p>

      {p.erro && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">{p.erro}</div>}
      {(p.salvo || p.teste || p.enviando || p.cancelado) && (
        <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} role="status">
          {p.salvo && "Rascunho salvo."}{p.teste && "Teste enviado para o seu e-mail. Confira a caixa de entrada e o spam."}{p.enviando && "Envio iniciado. Os e-mails saem em lotes, em alguns minutos."}{p.cancelado && "Envio cancelado. O que já saiu não volta."}
        </div>
      )}

      {!formOpen && (
        <div className="flex gap-2 flex-wrap mb-6">
          <Link href="/emails?novo=1" className="text-[13px] font-semibold px-4 py-2.5 rounded-[10px] border no-underline" style={btn}>Nova campanha</Link>
          {data.approvedEmails.length > 0 && (
            <form action="/emails" className="flex gap-2">
              <select name="de" className={inputCls} style={{ ...inputStyle, width: 260 }} aria-label="Usar texto aprovado">{data.approvedEmails.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
              <button type="submit" className="text-[12.5px] font-semibold px-3.5 rounded-[10px] border cursor-pointer whitespace-nowrap" style={btnGhost}>Usar texto aprovado</button>
            </form>
          )}
        </div>
      )}

      {formOpen && (
        <form action={saveCampaignAction.bind(null, editing?.id ?? null)} className="rounded-[16px] border p-5 grid gap-3 mb-8" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Nome da campanha (só você vê)</span><input name="name" required defaultValue={seed.name} maxLength={120} className={inputCls} style={inputStyle} /></label>
            <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Para quem</span>
              <select name="audience" defaultValue={seed.audience} className={inputCls} style={inputStyle}>{data.audiences.map((a) => <option key={a.key} value={a.key}>{a.label} ({a.count})</option>)}</select>
            </label>
          </div>
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Assunto</span><input name="subject" required defaultValue={seed.subject} maxLength={120} className={inputCls} style={inputStyle} /></label>
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Prévia que aparece ao lado do assunto (opcional)</span><input name="preheader" defaultValue={seed.preheader ?? ""} maxLength={140} className={inputCls} style={inputStyle} /></label>
          <label className="grid gap-1 text-[12px]"><span style={{ color: "var(--fg-muted)" }}>Texto</span>
            <textarea name="body" required rows={10} defaultValue={seed.body} className="rounded-[10px] border px-3 py-2 text-[13px] outline-none w-full" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", lineHeight: 1.55 }} />
            <span style={{ color: "var(--fg-faint)" }}>Texto simples; deixe uma linha em branco entre parágrafos. {"{{nome}}"} vira o primeiro nome da pessoa. O rodapé com seus dados e o link para sair é adicionado sozinho.</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            <button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btn}>Salvar rascunho</button>
            {editing && <button type="submit" formAction={sendTestAction.bind(null, editing.id)} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btnGhost}>Enviar teste para mim</button>}
            <Link href="/emails" className="text-[12.5px] px-3.5 py-2 no-underline" style={{ color: "var(--fg-muted)" }}>Fechar</Link>
          </div>

          {editing && data.preview && (
            <div className="mt-2 pt-4 border-t grid gap-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-[13px]">
                <strong>{data.preview.recipients}</strong> contato(s) vão receber.
                <span style={{ color: "var(--fg-faint)" }}> Ficam de fora: {data.preview.excluded.semBaseLegal} sem consentimento ou contrato registrado, {data.preview.excluded.semEmail} sem e-mail válido, {data.preview.excluded.descadastrados} que já pediram para sair.</span>
              </div>
              {data.preview.warnings.length > 0 && (
                <div className="rounded-[10px] border px-3 py-2 text-[12.5px] grid gap-1" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
                  <strong>Revise antes de enviar</strong>
                  {data.preview.warnings.map((w) => <span key={w}>• {w}</span>)}
                </div>
              )}
              {trialing ? (
                <p className="m-0 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>O envio para contatos reais fica disponível depois da assinatura.</p>
              ) : (
                <div className="grid gap-2">
                  <label className="flex items-start gap-2 text-[12.5px]"><input type="checkbox" name="confirm" className="mt-0.5" />Confirmo que estes contatos são clientes ou autorizaram receber e-mails da minha empresa.</label>
                  <div><button type="submit" formAction={startCampaignAction.bind(null, editing.id)} disabled={data.preview.recipients === 0} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={{ ...btn, opacity: data.preview.recipients === 0 ? 0.5 : 1 }}>Enviar para {data.preview.recipients} contato(s)</button></div>
                </div>
              )}
            </div>
          )}
        </form>
      )}

      <h2 className="text-[11px] uppercase font-medium mb-2" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>Campanhas</h2>
      {data.campaigns.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Nenhuma campanha ainda.</p>
      ) : (
        <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {data.campaigns.map((c, i) => {
            const pr = progress(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div>
                  {c.status === "DRAFT" ? <Link href={`/emails?id=${c.id}`} className="font-semibold no-underline" style={{ color: "var(--fg)" }}>{c.name}</Link> : <span className="font-semibold">{c.name}</span>}
                  <div className="text-[12px]" style={{ color: "var(--fg-faint)" }}>{STATUS[c.status]} · {formatBrasilia(c.createdAt)}{c.status !== "DRAFT" ? ` · ${pr.sent} enviado(s) de ${c.totalRecipients}${pr.failed ? `, ${pr.failed} sem entrega` : ""}` : ""}</div>
                </div>
                {c.status === "SENDING" && <form action={cancelCampaignAction.bind(null, c.id)}><button type="submit" className="text-[12px] font-semibold px-3 py-1.5 rounded-[10px] border cursor-pointer" style={btnGhost}>Cancelar envio</button></form>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
