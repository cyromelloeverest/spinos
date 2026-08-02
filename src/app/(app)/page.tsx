import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { Target, Kanban, Trophy, Sparkles, TrendingUp, ArrowRight } from "lucide-react";

function getGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function greetingName(userName: string | null | undefined, orgName: string | null | undefined): string {
  if (userName?.trim()) return userName.trim().split(" ")[0];
  if (orgName?.trim()) return orgName.trim();
  return "";
}

const FUNNEL_STAGES: { stage: string; label: string }[] = [
  { stage: "CONTATO_FEITO", label: "Contato feito" },
  { stage: "VISITA_AGENDADA", label: "Visita agendada" },
  { stage: "PROPOSTA_ENVIADA", label: "Proposta enviada" },
  { stage: "VENDIDO", label: "Vendido" },
  { stage: "PERDIDO", label: "Perdido" },
];

const RECENT_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;

async function fetchDashboardData(organizationId: string) {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  const [active, staged, won, lost, recentSignals, best, avgScoreResult] = await Promise.all([
    prisma.opportunityScore.count({ where: { organizationId, stage: null, status: { not: "DISMISSED" } } }),
    prisma.opportunityScore.count({
      where: { organizationId, stage: { notIn: ["VENDIDO", "PERDIDO"] } },
    }),
    prisma.opportunityScore.count({ where: { organizationId, stage: "VENDIDO" } }),
    prisma.opportunityScore.count({ where: { organizationId, stage: "PERDIDO" } }),
    prisma.opportunityScoreSignal.count({
      where: {
        opportunityScore: { organizationId, status: { not: "DISMISSED" } },
        signal: { detectedAt: { gte: since } },
      },
    }),
    prisma.opportunityScore.findMany({
      where: { organizationId, stage: null, status: { not: "DISMISSED" } },
      include: { company: true },
      orderBy: { score: "desc" },
      take: 5,
    }),
    prisma.opportunityScore.aggregate({
      where: { organizationId, stage: null, status: { not: "DISMISSED" } },
      _avg: { score: true },
    }),
  ]);

  const funnelCounts = await Promise.all(
    FUNNEL_STAGES.map(({ stage }) => prisma.opportunityScore.count({ where: { organizationId, stage: stage as never } })),
  );

  const closedTotal = won + lost;
  const conversionRate = closedTotal > 0 ? Math.round((won / closedTotal) * 100) : null;

  return {
    active,
    staged,
    won,
    recentSignals,
    best,
    avgScore: avgScoreResult._avg.score,
    conversionRate,
    funnel: FUNNEL_STAGES.map((s, i) => ({ ...s, count: funnelCounts[i] })),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ senhaAtualizada?: string }>;
}) {
  const params = await searchParams;
  const [organizationId, userId] = await Promise.all([getCurrentOrganizationId(), getCurrentUserId()]);
  if (!organizationId) redirect("/onboarding");

  let data: Awaited<ReturnType<typeof fetchDashboardData>>;
  let user: { name: string | null } | null = null;
  let organization: { name: string } | null = null;
  try {
    [data, user, organization] = await Promise.all([
      fetchDashboardData(organizationId),
      userId ? prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : Promise.resolve(null),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    ]);
  } catch {
    return <DbSetupNotice />;
  }

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));
  const name = greetingName(user?.name, organization?.name);

  return (
    <div>
      <div className="pt-6 px-10">
        <div className="text-[11px] uppercase font-semibold mb-1" style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}>
          Dashboard
        </div>
        <h1 className="text-[25px] font-bold m-0 mb-1">
          {getGreeting()}
          {name ? `, ${name}` : ""}!
        </h1>
        <p className="m-0 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          Visão geral do seu funil comercial.
        </p>
      </div>

      {params.senhaAtualizada && (
        <div className="mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--good)", color: "var(--good)" }}>
          Senha atualizada com sucesso.
        </div>
      )}

      <div className="px-10 pt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <KpiCard icon={Target} label="Oportunidades ativas" value={data.active} />
        <KpiCard icon={Kanban} label="No pipeline" value={data.staged} />
        <KpiCard icon={Trophy} label="Vendidas" value={data.won} />
        <KpiCard
          icon={TrendingUp}
          label="Taxa de conversão"
          value={data.conversionRate !== null ? `${data.conversionRate}%` : "—"}
        />
        <KpiCard icon={Sparkles} label="Novidades (10 dias)" value={data.recentSignals} />
      </div>

      <div className="px-10 pt-8 pb-16 grid gap-6" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <div>
          <h2 className="text-[11.5px] uppercase font-semibold m-0 mb-3.5" style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}>
            Melhores oportunidades
          </h2>
          <div className="flex flex-col gap-2.5">
            {data.best.length === 0 && (
              <div className="rounded-[10px] border border-dashed p-5 text-[12.5px] text-center" style={{ borderColor: "var(--border)", color: "var(--fg-faint)" }}>
                Nenhuma oportunidade ativa ainda.
              </div>
            )}
            {data.best.map((opp) => (
              <Link
                key={opp.id}
                href={`/company/${opp.id}`}
                className="flex items-center gap-4 rounded-[14px] border px-4 py-3 no-underline"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", boxShadow: "var(--shadow-card)" }}
              >
                <div
                  className="w-10 h-10 rounded-[9px] flex items-center justify-center font-semibold text-[15px] flex-shrink-0"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: opp.score >= 85 ? "var(--primary)" : "var(--primary-soft)",
                    color: opp.score >= 85 ? "#ffffff" : "var(--primary)",
                  }}
                >
                  {opp.score}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold truncate">{opp.company.name}</div>
                  <div className="text-[11.5px] truncate" style={{ color: "var(--fg-faint)" }}>
                    {opp.company.city}, {opp.company.state}
                  </div>
                </div>
                <ArrowRight size={15} strokeWidth={1.75} style={{ color: "var(--fg-faint)" }} className="flex-shrink-0" />
              </Link>
            ))}
          </div>
          <Link
            href="/oportunidades"
            className="inline-flex items-center gap-1 mt-3 text-[12.5px] font-medium no-underline"
            style={{ color: "var(--primary)" }}
          >
            Ver todas as oportunidades
            <ArrowRight size={13} strokeWidth={2} />
          </Link>
        </div>

        <div>
          <h2 className="text-[11.5px] uppercase font-semibold m-0 mb-3.5" style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}>
            Funil comercial
          </h2>
          <div
            className="rounded-[16px] border p-5 flex flex-col gap-3.5"
            style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
          >
            {data.funnel.map((f) => (
              <div key={f.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
                    {f.label}
                  </span>
                  <span className="text-[12.5px] font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                    {f.count}
                  </span>
                </div>
                <div className="h-[6px] rounded-full" style={{ background: "var(--card-hover)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(f.count / maxFunnel) * 100}%`,
                      background: f.stage === "VENDIDO" ? "var(--good)" : f.stage === "PERDIDO" ? "var(--critical)" : "var(--primary)",
                    }}
                  />
                </div>
              </div>
            ))}
            <Link
              href="/pipeline"
              className="inline-flex items-center gap-1 mt-1 text-[12.5px] font-medium no-underline"
              style={{ color: "var(--primary)" }}
            >
              Ver pipeline completo
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="rounded-[16px] border p-4 flex flex-col gap-2.5"
      style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="w-8 h-8 rounded-[8px] flex items-center justify-center"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div>
        <div className="text-[22px] font-bold leading-none" style={{ fontFamily: "var(--font-mono)" }}>
          {value}
        </div>
        <div className="text-[11.5px] mt-1" style={{ color: "var(--fg-muted)" }}>
          {label}
        </div>
      </div>
    </div>
  );
}
