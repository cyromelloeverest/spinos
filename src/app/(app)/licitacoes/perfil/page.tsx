import Link from "next/link";
import { withOrgContext } from "@/lib/db/with-org-context";
import { requireBiddingAccess } from "@/lib/licitacoes/access";
import {
  saveBidderProfile,
  addBidderDocument,
  renewBidderDocument,
  removeBidderDocument,
  addBidderCertificate,
  removeBidderCertificate,
} from "@/lib/actions/licitacoes-perfil";
import {
  HABILITACAO_CATEGORIES,
  HABILITACAO_CATEGORY_LABEL,
  VALIDITY_LABEL,
  validityStatus,
  currentVersions,
  type ValidityStatus,
} from "@/lib/licitacoes/habilitacao";
import { FormField } from "@/components/FormField";
import { TextAreaField } from "@/components/TextAreaField";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { logError } from "@/lib/log-error";
import { ChevronLeft, Trash2 } from "lucide-react";

const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "44px" } as const;

const STATUS_COLOR: Record<ValidityStatus, string> = {
  sem_validade: "var(--fg-faint)",
  vigente: "var(--primary)",
  vence_em_breve: "var(--warn)",
  vencido: "var(--critical)",
};

function fmt(d: Date | null): string {
  return d ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
}

function iso(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function DateField({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium">{label}</span>
      <input type="date" name={name} defaultValue={defaultValue} className="rounded-[10px] border px-3.5 text-[13.5px] outline-none" style={inputStyle} />
    </label>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer"
      style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
    >
      {children}
    </button>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-[15px] font-semibold m-0 mb-1">{title}</h2>
      {description && (
        <p className="text-[12.5px] leading-[1.6] m-0 mb-4" style={{ color: "var(--fg-muted)" }}>
          {description}
        </p>
      )}
      {children}
    </section>
  );
}

export default async function PerfilHabilitacaoPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { organizationId } = await requireBiddingAccess();
  const params = await searchParams;

  let data;
  try {
    data = await withOrgContext(organizationId, async (tx) => ({
      profile: await tx.bidderProfile.findUnique({ where: { organizationId } }),
      documents: await tx.bidderDocument.findMany({ where: { organizationId }, orderBy: [{ category: "asc" }, { name: "asc" }, { version: "desc" }] }),
      certificates: await tx.bidderCertificate.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    }));
  } catch (err) {
    logError("licitacoes/perfil: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }

  const { profile, documents, certificates } = data;
  const current = currentVersions(documents);
  const historyCount = (id: string) => {
    let n = 0;
    let cursor = documents.find((d) => d.id === id);
    while (cursor?.previousVersionId) {
      n++;
      cursor = documents.find((d) => d.id === cursor!.previousVersionId);
    }
    return n;
  };

  return (
    <div className="pt-10 px-4 md:px-10 pb-16 max-w-[760px]">
      <Link href="/licitacoes" className="inline-flex items-center gap-1 text-[12.5px] no-underline mb-4" style={{ color: "var(--fg-muted)" }}>
        <ChevronLeft size={14} strokeWidth={1.75} /> Licitações
      </Link>
      <h1 className="text-[25px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Perfil de habilitação
      </h1>
      <p className="m-0 mb-8 text-[13.5px] leading-[1.6]" style={{ color: "var(--fg-muted)" }}>
        O que a sua empresa faz e quais documentos ela possui. A análise de editais usa esse cadastro para comparar com as exigências. Um requisito só é
        considerado atendido quando existe documento cadastrado e dentro da validade.
      </p>

      {params.saved && (
        <div className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
          Alterações salvas.
        </div>
      )}
      {params.error && (
        <div className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
          {params.error}
        </div>
      )}

      <Section title="Atuação e capacidade" description="Texto livre. Não coloque senhas, números de contas bancárias nem dados pessoais de terceiros.">
        <form action={saveBidderProfile} className="flex flex-col gap-4">
          <FormField label="Serviços prestados" name="services" defaultValue={profile?.services.join(", ")} hint="Separe por vírgula. Ex.: manutenção predial, limpeza, TI" />
          <FormField label="Regiões de atuação" name="regions" defaultValue={profile?.regions.join(", ")} hint="Estados ou cidades, separados por vírgula." />
          <TextAreaField label="Capacidade técnica" name="technicalCapabilities" defaultValue={profile?.technicalCapabilities ?? ""} hint="Equipamentos, certificações, estrutura, experiência relevante." />
          <TextAreaField label="Equipe disponível" name="teamAvailable" defaultValue={profile?.teamAvailable ?? ""} rows={3} />
          <FormField label="Margem mínima aceitável (%)" name="minMarginPct" defaultValue={profile?.minMarginPct != null ? String(profile.minMarginPct) : ""} hint="Usada no simulador de preço mínimo. Não há valor padrão." />
          <TextAreaField label="Observações" name="notes" defaultValue={profile?.notes ?? ""} rows={3} />
          <div>
            <PrimaryButton>Salvar perfil</PrimaryButton>
          </div>
        </form>
      </Section>

      <Section
        title="Documentos de habilitação"
        description="Cadastre número, órgão emissor e validade. O arquivo em PDF poderá ser anexado na próxima etapa. Ao renovar, a versão anterior fica no histórico."
      >
        {HABILITACAO_CATEGORIES.map((category) => {
          const items = current.filter((d) => d.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mb-5">
              <div className="text-[11px] uppercase font-medium mb-1.5" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>
                {HABILITACAO_CATEGORY_LABEL[category]}
              </div>
              <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                {items.map((doc, i) => {
                  const status = validityStatus(doc.expiresAt);
                  return (
                    <div key={doc.id} className="px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-medium">{doc.name}</div>
                          <div className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                            {[doc.number && `Nº ${doc.number}`, doc.issuer, `Emissão ${fmt(doc.issuedAt)}`, `Validade ${fmt(doc.expiresAt)}`, doc.version > 1 && `Versão ${doc.version}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                          <div className="text-[11.5px] mt-1 font-medium" style={{ color: STATUS_COLOR[status] }}>
                            {VALIDITY_LABEL[status]}
                            {historyCount(doc.id) > 0 && (
                              <span className="font-normal" style={{ color: "var(--fg-faint)" }}>
                                {" "}
                                · {historyCount(doc.id)} versão(ões) anterior(es) no histórico
                              </span>
                            )}
                          </div>
                        </div>
                        <form action={removeBidderDocument.bind(null, doc.id)}>
                          <button type="submit" aria-label={`Remover ${doc.name}`} className="cursor-pointer border-0 bg-transparent p-1" style={{ color: "var(--fg-faint)" }}>
                            <Trash2 size={15} strokeWidth={1.75} />
                          </button>
                        </form>
                      </div>
                      <details className="mt-2">
                        <summary className="text-[12px] cursor-pointer" style={{ color: "var(--primary)" }}>
                          Renovar documento
                        </summary>
                        <form action={renewBidderDocument.bind(null, doc.id)} className="grid gap-3 mt-3 md:grid-cols-2">
                          <FormField label="Nome" name="name" required defaultValue={doc.name} />
                          <FormField label="Número" name="number" defaultValue={doc.number ?? ""} />
                          <FormField label="Órgão emissor" name="issuer" defaultValue={doc.issuer ?? ""} />
                          <div />
                          <DateField label="Emissão" name="issuedAt" />
                          <DateField label="Validade" name="expiresAt" />
                          <div>
                            <PrimaryButton>Salvar nova versão</PrimaryButton>
                          </div>
                        </form>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {current.length === 0 && (
          <p className="text-[12.5px] mb-4" style={{ color: "var(--fg-muted)" }}>
            Nenhum documento cadastrado ainda.
          </p>
        )}

        <form action={addBidderDocument} className="rounded-[16px] border p-4 grid gap-3 md:grid-cols-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-[12.5px] font-medium">Categoria</span>
            <select name="category" required className="rounded-[10px] border px-3 text-[13.5px] outline-none" style={inputStyle} defaultValue="CERTIDAO">
              {HABILITACAO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {HABILITACAO_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <FormField label="Nome do documento" name="name" required placeholder="Ex.: Certidão negativa de débitos federais" />
          <FormField label="Número" name="number" />
          <FormField label="Órgão emissor" name="issuer" />
          <div />
          <DateField label="Emissão" name="issuedAt" />
          <DateField label="Validade" name="expiresAt" />
          <div className="md:col-span-2">
            <PrimaryButton>Adicionar documento</PrimaryButton>
          </div>
        </form>
      </Section>

      <Section title="Atestados de capacidade técnica" description="Contratos já executados, para comprovar experiência anterior.">
        {certificates.length > 0 && (
          <div className="rounded-[12px] border overflow-hidden mb-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {certificates.map((c, i) => (
              <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{c.title}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                    {[c.contractingParty, (c.periodStart || c.periodEnd) && `${fmt(c.periodStart)} a ${fmt(c.periodEnd)}`, c.quantities].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <form action={removeBidderCertificate.bind(null, c.id)}>
                  <button type="submit" aria-label={`Remover ${c.title}`} className="cursor-pointer border-0 bg-transparent p-1" style={{ color: "var(--fg-faint)" }}>
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
        <form action={addBidderCertificate} className="rounded-[16px] border p-4 grid gap-3 md:grid-cols-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="md:col-span-2">
            <FormField label="Título" name="title" required placeholder="Ex.: Manutenção de ar-condicionado — 120 equipamentos" />
          </div>
          <FormField label="Contratante" name="contractingParty" />
          <FormField label="Quantitativos" name="quantities" placeholder="Ex.: 120 equipamentos, 24 meses" />
          <DateField label="Início do período" name="periodStart" />
          <DateField label="Fim do período" name="periodEnd" />
          <div className="md:col-span-2">
            <PrimaryButton>Adicionar atestado</PrimaryButton>
          </div>
        </form>
      </Section>
    </div>
  );
}
