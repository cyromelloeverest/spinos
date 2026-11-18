import Link from "next/link";
import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { newLead } from "@/lib/actions/crm";
import { ORIGIN_OPTIONS, originLabel } from "@/lib/crm/origin-options";
import { readConfig } from "@/lib/automations/recipes";
import { slaMinutesLeft, slaLabel } from "@/lib/crm/leads";
import { logError } from "@/lib/log-error";

const TABS = [
  { key: "novos", label: "Sem atendimento" },
  { key: "atendimento", label: "Em atendimento" },
  { key: "todos", label: "Todos" },
] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ aba?: string; erro?: string }> }) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");
  const tab = TABS.some((t) => t.key === params.aba) ? (params.aba as (typeof TABS)[number]["key"]) : "novos";
  const now = new Date();

  let data;
  try {
    data = await withOrgContext(organizationId, async (tx) => {
      const sla = await tx.automation.findUnique({ where: { organizationId_key: { organizationId, key: "lead_response" } } });
      const slaMinutes = readConfig("lead_response", sla?.config).slaMinutes;
      // Lead = negociação aberta cuja origem NÃO é a prospecção do Spinos (alguém chegou ou foi cadastrado).
      const leads = await tx.opportunity.findMany({
        where: {
          organizationId,
          status: "OPEN",
          account: { is: { origins: { some: { isFirstTouch: true, kind: { not: "PROSPECTING" } } } } },
          ...(tab === "novos" ? { firstResponseAt: null } : tab === "atendimento" ? { firstResponseAt: { not: null } } : {}),
        },
        orderBy: { createdAt: tab === "novos" ? "asc" : "desc" },
        take: 100,
        include: { account: { include: { contacts: { where: { isPrimary: true }, take: 1 }, origins: { where: { isFirstTouch: true }, take: 1 } } }, stage: true },
      });
      return { leads, slaMinutes };
    });
  } catch (err) {
    logError("leads: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[1080px]">
      <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>Leads</h1>
      <p className="m-0 mb-5 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Pessoas que chegaram até você (formulário, indicação, anúncio) ou que você cadastrou. O prazo de primeiro atendimento é de {data.slaMinutes} minutos.
      </p>

      {params.erro && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">{params.erro}</div>}

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <Link key={t.key} href={`/leads?aba=${t.key}`} className="no-underline text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[10px] border" style={{ background: tab === t.key ? "var(--primary)" : "var(--card)", color: tab === t.key ? "#ffffff" : "var(--fg-muted)", borderColor: tab === t.key ? "var(--primary)" : "var(--border)" }}>
            {t.label}
          </Link>
        ))}
      </div>

      {data.leads.length === 0 ? (
        <EmptyState message={tab === "novos" ? "Nenhum lead esperando atendimento." : "Nenhum lead por aqui."} />
      ) : (
        <div className="rounded-[12px] border overflow-hidden mb-8" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {data.leads.map((l, i) => {
            const contact = l.account.contacts[0];
            const left = slaMinutesLeft(l.createdAt, data.slaMinutes, now);
            return (
              <Link key={l.id} href={`/pipeline?abrir=${l.id}&owner=all`} className="block no-underline" style={{ color: "var(--fg)" }}>
                <div className="flex items-center justify-between gap-4 px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{contact?.name ?? l.account.name}{contact && l.account.name !== contact.name ? ` · ${l.account.name}` : ""}</div>
                    <div className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
                      {originLabel(l.account.origins[0]?.channel)} · {l.stage.name}
                      {contact?.phone ? ` · ${contact.phone}` : ""}
                    </div>
                  </div>
                  {l.firstResponseAt === null ? (
                    <span className="text-[12px] font-semibold flex-shrink-0" style={{ color: left < 0 ? "var(--critical)" : "var(--warn)" }}>{slaLabel(left)}</span>
                  ) : (
                    <span className="text-[12px] flex-shrink-0" style={{ color: "var(--fg-faint)" }}>Atendido</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <section className="rounded-[16px] border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <h2 className="text-[15px] font-semibold m-0 mb-3">Cadastrar lead</h2>
        <form action={newLead} className="grid gap-3 md:grid-cols-2">
          <FormField label="Nome do contato" name="name" required />
          <FormField label="Empresa" name="company" />
          <FormField label="Telefone ou WhatsApp" name="phone" />
          <FormField label="E-mail" name="email" />
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium">Origem</span>
            <select name="origin" defaultValue="indicacao" className="rounded-[10px] border px-3 text-[13.5px]" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "44px" }}>
              {ORIGIN_OPTIONS.filter((o) => o.key !== "spinos").map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <FormField label="O que a pessoa pediu" name="message" />
          <div className="md:col-span-2">
            <button type="submit" className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer" style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}>
              Cadastrar lead
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
