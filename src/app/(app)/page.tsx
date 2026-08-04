import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { SpinosScore } from "@/components/SpinosScore";
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
const HOT_SCORE_THRESHOLD = 85;

async function fetchDashboardData(organizationId: string) {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const activeFilter = { organizationId, stage: null, status: { not: "DISMISSED" } } as const;

  const [active, staged, won, lost, recentSignals, best, avgScoreResult, hotCount] = await Promise.all([
    prisma.opportunityScore.count({ where: activeFilter }),
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
      where: activeFilter,
      include: { company: true },
      orderBy: { score: "desc" },
      take: 5,
    }),
    prisma.opportunityScore.aggregate({ where: activeFilter, _avg: { score: true } }),
    prisma.opportunityScore.count({ where: { ...activeFilter, score: { gte: HOT_SCORE_THRESHOLD } } }),
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
    hotCount,
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
  const avgScoreRounded = data.avgScore !== null ? Math.round(data.avgScore) : null;

  return (
    <div>
      <div className="pt-6 px-4 md:px-10">
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
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--good)", color: "var(--good)" }}>
          Senha atualizada com sucesso.
        </div>
      )}

      <div className="px-4 md:px-10 pt-6">
        {avgScoreRounded !== null ? (
          <div
            className="rounded-[20px] border p-6 md:p-7 flex flex-col md:flex-row items-center gap-6 md:gap-8"
            style={{ background: "var(--card)", borderColor: "var(--primary-line)", boxShadow: "var(--shadow-card)" }}
          >
            <SpinosScore value={avgScoreRounded} variant="hero" />
            <div className="flex-1 min-w-0 text-center md:text-left">
              <div
                className="text-[11px] uppercase font-semibold mb-1.5"
                style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}
              >
                Spinos Score médio das suas oportunidades ativas
              </div>
              <p
                className="text-[16px] leading-[1.5] m-0 mb-3"
                style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
              >
                {data.hotCount > 0
                  ? `${data.hotCount} ${data.hotCount === 1 ? "oportunidade está" : "oportunidades estão"} no patamar mais quente (${HOT_SCORE_THRESHOLD}+) — prontas pra abordagem agora.`
                  : `Nenhuma oportunidade no patamar mais quente (${HOT_SCORE_THRESHOLD}+) ainda — vale acompanhar as próximas buscas.`}
              </p>
              <Link
                href="/oportunidades"
                className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline"
                style={{ color: "var(--primary)" }}
              >
                Ver oportunidades
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
          </div>
        ) : (
          <div
            className="rounded-[20px] border border-dashed p-8 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-[14px] m-0 mb-3" style={{ color: "var(--fg-muted)" }}>
              Ainda sem oportunidades ativas — rode sua primeira busca pra descobrir o Spinos Score das suas
              melhores empresas-alvo.
            </p>
            <Link
              href="/oportunidades"
              className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline"
              style={{ color: "var(--primary)" }}
            >
              Buscar oportunidades
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          </div>
        )}
      </div>

      <div className="px-4 md:px-10 pt-5 grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <StatTile icon={Target} label="Oportunidades ativas" value={data.active} accent="var(--primary)" />
        <StatTile icon={Kanban} label="No pipeline" value={data.staged} accent="var(--primary)" />
        <StatTile icon={Trophy} label="Vendidas" value={data.won} accent="var(--good)" />
        <StatTile
          icon={TrendingUp}
          label="Taxa de conversão"
          value={data.conversionRate !== null ? `${data.conversionRate}%` : "—"}
          accent="var(--good)"
        />
      </div>

      <div className="px-4 md:px-10 pt-8 pb-16 grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6">
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-[11.5px] uppercase font-semibold m-0" style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}>
              Melhores oportunidades
            </h2>
            {data.recentSignals > 0 && (
              <Link
                href="/radar"
                className="flex items-center gap-1 text-[11.5px] font-medium no-underline"
                style={{ color: "var(--primary)" }}
              >
                <Sparkles size={12} strokeWidth={2} />
                {data.recentSignals} novidade{data.recentSignals === 1 ? "" : "s"}
              </Link>
            )}
          </div>
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
                <SpinosScore value={opp.score} variant="compact" />
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

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div
      className="rounded-[14px] border overflow-hidden"
      style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div style={{ height: 3, background: accent }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11.5px] font-medium" style={{ color: "var(--fg-muted)" }}>
            {label}
          </div>
          <Icon size={14} strokeWidth={1.75} style={{ color: "var(--fg-faint)" }} />
        </div>
        <div className="text-[26px] font-bold leading-none" style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>
          {value}
        </div>
      </div>
    </div>
  );
}
