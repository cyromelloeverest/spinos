import Link from "next/link";
import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { EmptyState } from "@/components/EmptyState";
import { setContactLegalBasis, anonymizeContact } from "@/lib/actions/crm";
import { toWhatsAppUrl } from "@/lib/crm/whatsapp";
import { logError } from "@/lib/log-error";

const BASIS_LABEL = { LEGITIMATE_INTEREST: "Legítimo interesse", CONSENT: "Consentimento", CONTRACT: "Contrato" } as const;

export default async function ContatosPage({ searchParams }: { searchParams: Promise<{ q?: string; erro?: string; salvo?: string }> }) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");
  const q = (params.q ?? "").trim().slice(0, 80);

  let contacts;
  try {
    contacts = await withOrgContext(organizationId, (tx) =>
      tx.contact.findMany({
        where: {
          organizationId,
          anonymizedAt: null,
          ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { account: { is: { name: { contains: q, mode: "insensitive" } } } }] } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { account: { select: { name: true, scores: { select: { id: true }, take: 1 }, opportunities: { select: { id: true }, take: 1, orderBy: { createdAt: "desc" } } } } },
      }),
    );
  } catch (err) {
    logError("contatos: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[980px]">
      <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>Contatos</h1>
      <p className="m-0 mb-5 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        As pessoas das empresas que você acompanha, com a base legal do tratamento de cada uma (LGPD).
      </p>
      {params.erro && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">{params.erro}</div>}
      {params.salvo && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} role="status">Salvo.</div>}

      <form method="get" className="mb-5">
        <input name="q" defaultValue={q} placeholder="Buscar por nome, empresa, e-mail ou telefone" className="w-full rounded-[10px] border px-3.5 text-[13.5px] outline-none" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "44px" }} />
      </form>

      {contacts.length === 0 ? (
        <EmptyState message={q ? "Nenhum contato encontrado para essa busca." : "Nenhum contato cadastrado ainda."} />
      ) : (
        <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {contacts.map((c, i) => {
            const ref = c.account?.scores[0]?.id ?? c.account?.opportunities[0]?.id ?? null;
            const wa = toWhatsAppUrl(c.phone);
            return (
              <div key={c.id} className="px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">
                      {c.name}
                      {c.isPrimary && <span className="ml-2 text-[10px] font-semibold uppercase rounded-full px-1.5 py-[1px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>Principal</span>}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
                      {[c.jobTitle, c.account?.name, c.email, c.phone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    {wa && <a href={wa} target="_blank" rel="noreferrer" className="no-underline font-semibold" style={{ color: "var(--good)" }}>WhatsApp</a>}
                    {ref && <Link href={`/pipeline?abrir=${ref}&owner=all`} className="no-underline font-semibold" style={{ color: "var(--primary)" }}>Abrir</Link>}
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="text-[12px] cursor-pointer" style={{ color: c.legalBasis ? "var(--fg-muted)" : "var(--warn)" }}>
                    Base legal: {c.legalBasis ? BASIS_LABEL[c.legalBasis] : "a registrar"}
                  </summary>
                  <form action={setContactLegalBasis.bind(null, c.id)} className="grid gap-2 mt-2 md:grid-cols-[200px_1fr_auto]">
                    <select name="legalBasis" defaultValue={c.legalBasis ?? ""} className="rounded-[10px] border px-3 text-[13px]" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "40px" }}>
                      <option value="">A registrar</option>
                      {Object.entries(BASIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input name="legalBasisNote" defaultValue={c.legalBasisNote ?? ""} placeholder="De onde veio o contato (ex.: dado público da Receita)" className="rounded-[10px] border px-3 text-[13px]" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "40px" }} />
                    <button type="submit" className="text-[12.5px] font-semibold px-3.5 rounded-[10px] border cursor-pointer" style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}>Salvar</button>
                  </form>
                  <a href={`/contatos/${c.id}/dados`} className="mt-2 inline-block text-[12px]" style={{ color: "var(--primary)" }}>Baixar os dados desta pessoa (LGPD)</a>
                  <form action={anonymizeContact.bind(null, c.id)} className="mt-2">
                    <button type="submit" className="cursor-pointer border-0 bg-transparent p-0 text-[12px]" style={{ color: "var(--critical)" }}>Anonimizar esta pessoa (LGPD)</button>
                  </form>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
