import Link from "next/link";
import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { SpinosScore } from "@/components/SpinosScore";
import { EmptyState } from "@/components/EmptyState";
import { PIPELINE_STAGE_LABEL } from "@/lib/pipeline-stages";
import { logError } from "@/lib/log-error";
import { PageHeader } from "@/components/PageHeader";
import { History } from "lucide-react";
import { ListCard } from "@/components/ListCard";

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  CONTATO_FEITO: { label: PIPELINE_STAGE_LABEL.CONTATO_FEITO, bg: "var(--primary-soft)", color: "var(--primary)" },
  VISITA_AGENDADA: { label: PIPELINE_STAGE_LABEL.VISITA_AGENDADA, bg: "var(--primary-soft)", color: "var(--primary)" },
  PROPOSTA_ENVIADA: { label: PIPELINE_STAGE_LABEL.PROPOSTA_ENVIADA, bg: "var(--primary-soft)", color: "var(--primary)" },
  VENDIDO: { label: PIPELINE_STAGE_LABEL.VENDIDO, bg: "var(--good-soft)", color: "var(--good)" },
  PERDIDO: { label: PIPELINE_STAGE_LABEL.PERDIDO, bg: "var(--card-hover)", color: "var(--critical)" },
  DESCARTADA: { label: "Descartada", bg: "var(--card-hover)", color: "var(--fg-faint)" },
  ATIVA: { label: "Ativa", bg: "var(--card-hover)", color: "var(--fg-muted)" },
};

function fetchHistory(organizationId: string) {
  return withOrgContext(organizationId, (tx) =>
    tx.opportunityScore.findMany({
      where: { organizationId },
      include: {
        company: true,
        account: { include: { opportunities: { include: { stage: true }, orderBy: { createdAt: "desc" }, take: 1 } } },
      },
    }),
  ).then((rows) =>
    rows
      .map((r) => ({ ...r, stageKey: r.account?.opportunities[0]?.stage.key ?? null, stageName: r.account?.opportunities[0]?.stage.name ?? null, stageKind: r.account?.opportunities[0]?.stage.kind ?? null, sortKey: (r.account?.opportunities[0]?.stageChangedAt ?? r.computedAt).getTime() }))
      .sort((a, b) => b.sortKey - a.sortKey),
  );
}

function statusKey(opp: { stageKey: string | null; stageKind?: string | null; status: string }): string {
  if (opp.stageKind === "WON") return "VENDIDO";
  if (opp.stageKind === "LOST") return "PERDIDO";
  if (opp.stageKey) return opp.stageKey;
  if (opp.status === "DISMISSED") return "DESCARTADA";
  return "ATIVA";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function HistoricoPage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let opportunities: Awaited<ReturnType<typeof fetchHistory>> = [];
  let dbError = false;
  try {
    opportunities = await fetchHistory(organizationId);
  } catch (err) {
    logError("historico: falha ao carregar histórico", err, { organizationId });
    dbError = true;
  }
  if (dbError) return <DbSetupNotice />;

  return (
    <div>
      <PageHeader inset title="Histórico de oportunidades">
        Todas as oportunidades já encontradas para o seu ICP, em um único lugar — ativas, no pipeline, vendidas, perdidas ou descartadas.
      </PageHeader>

      <div className="px-4 md:px-10 pt-6 pb-16 flex flex-col gap-2.5 max-w-[1080px]">
        {opportunities.length === 0 && <EmptyState icon={History} message="Nenhuma oportunidade encontrada ainda." action={{ label: "Buscar oportunidades", href: "/oportunidades" }} />}

        {opportunities.map((opp) => {
          const key = statusKey(opp);
          const base = STATUS_LABEL[key] ?? (opp.stageName ? STATUS_LABEL.CONTATO_FEITO : STATUS_LABEL.ATIVA);
          // O nome da etapa vem do funil da organização (pode ser de um pacote de nicho).
          const badge = opp.stageName && opp.stageKind === "OPEN" ? { ...base, label: opp.stageName } : opp.stageName && (opp.stageKind === "WON" || opp.stageKind === "LOST") ? { ...base, label: opp.stageName } : base;
          return (
            <ListCard
              key={opp.id}
              href={`/company/${opp.id}`}
              leading={<SpinosScore value={opp.score} variant="compact" />}
              title={opp.company.name}
              subtitle={`${opp.company.city}, ${opp.company.state} · encontrada em ${formatDate(opp.computedAt)}`}
              right={
                <span className="text-[11.5px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap" style={{ background: badge.bg, color: badge.color }}>
                  {badge.label}
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
