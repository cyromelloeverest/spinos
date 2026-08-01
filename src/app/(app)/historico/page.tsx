import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  CONTATO_FEITO: { label: "Contato feito", bg: "var(--copper-soft)", color: "var(--copper)" },
  VISITA_AGENDADA: { label: "Visita agendada", bg: "var(--copper-soft)", color: "var(--copper)" },
  PROPOSTA_ENVIADA: { label: "Proposta enviada", bg: "var(--copper-soft)", color: "var(--copper)" },
  VENDIDO: { label: "Vendido", bg: "var(--good-soft)", color: "var(--good)" },
  PERDIDO: { label: "Perdido", bg: "var(--card-hover)", color: "var(--critical)" },
  DESCARTADA: { label: "Descartada", bg: "var(--card-hover)", color: "var(--fg-faint)" },
  ATIVA: { label: "Ativa", bg: "var(--card-hover)", color: "var(--fg-muted)" },
};

function fetchHistory(organizationId: string) {
  return prisma.opportunityScore.findMany({
    where: { organizationId },
    include: { company: true },
    orderBy: [{ stageUpdatedAt: "desc" }, { computedAt: "desc" }],
  });
}

function statusKey(opp: { stage: string | null; status: string }): string {
  if (opp.stage) return opp.stage;
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
  } catch {
    dbError = true;
  }
  if (dbError) return <DbSetupNotice />;

  return (
    <div>
      <div className="pt-6 px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Histórico de oportunidades
        </h1>
        <p className="m-0 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          Todas as oportunidades já encontradas para o seu ICP, em um único lugar — ativas, no pipeline, vendidas, perdidas ou descartadas.
        </p>
      </div>

      <div className="px-10 pt-6 pb-16 flex flex-col gap-2 max-w-[880px]">
        {opportunities.length === 0 && (
          <div className="rounded-[10px] border border-dashed p-6 text-[13px] text-center" style={{ borderColor: "var(--border)", color: "var(--fg-faint)" }}>
            Nenhuma oportunidade encontrada ainda.
          </div>
        )}

        {opportunities.map((opp) => {
          const key = statusKey(opp);
          const badge = STATUS_LABEL[key] ?? STATUS_LABEL.ATIVA;
          return (
            <Link
              key={opp.id}
              href={`/company/${opp.id}`}
              className="flex items-center gap-4 rounded-xl border px-4 py-3 no-underline"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
            >
              <div
                className="w-11 h-11 rounded-[9px] flex items-center justify-center border font-semibold text-[16px] flex-shrink-0"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                  background: "var(--card-hover)",
                  color: "var(--fg-muted)",
                  borderColor: "var(--border)",
                }}
              >
                {opp.score}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{opp.company.name}</div>
                <div className="text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>
                  {opp.company.city}, {opp.company.state} · encontrada em {formatDate(opp.computedAt)}
                </div>
              </div>

              <div
                className="text-[11px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap flex-shrink-0"
                style={{ background: badge.bg, color: badge.color }}
              >
                {badge.label}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
