import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { SpinosScore } from "@/components/SpinosScore";
import { EmptyState } from "@/components/EmptyState";
import { Target, Kanban, Trophy, Sparkles, TrendingUp, ArrowRight, Rocket } from "lucide-react";
import { logError } from "@/lib/log-error";
import { PIPELINE_STAGE_ORDER, PIPELINE_STAGE_LABEL, pipelineStageColor } from "@/lib/pipeline-stages";

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

const FUNNEL_STAGES = PIPELINE_STAGE_ORDER.map((stage) => ({ stage, label: PIPELINE_STAGE_LABEL[stage] }));

const RECENT_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;
const HOT_SCORE_THRESHOLD = 85;

// Prioriza quem ainda não foi trabalhado (status NEW, sem stage nenhum) —
// "fale com uma empresa hoje" não faz sentido apontando pra alguém que já
// está em conversa. Se a missão inteira já foi trabalhada, cai pra maior
// nota geral em vez de não sugerir nada.
function pickNextMissionOpportunity(
  scores: { id: string; status: string; stage: string | null; score: number }[],
): string | null {
  if (scores.length === 0) return null;
  const untouched = scores.filter((o) => o.status === "NEW" && o.stage === null);
  const pool = untouched.length > 0 ? untouched : scores;
  return pool.reduce((best, o) => (o.score > best.score ? o : best), pool[0]).id;
}

async function fetchDashboardData(tx: Prisma.TransactionClient, organizationId: string) {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const activeFilter = { organizationId, stage: null, status: { not: "DISMISSED" } } as const;

  const [active, staged, won, lost, recentSignals, best, avgScoreResult, hotCount] = await Promise.all([
    tx.opportunityScore.count({ where: activeFilter }),
    tx.opportunityScore.count({
      where: { organizationId, stage: { notIn: ["VENDIDO", "PERDIDO"] } },
    }),
    tx.opportunityScore.count({ where: { organizationId, stage: "VENDIDO" } }),
    tx.opportunityScore.count({ where: { organizationId, stage: "PERDIDO" } }),
    tx.opportunityScoreSignal.count({
      where: {
        opportunityScore: { organizationId, status: { not: "DISMISSED" } },
        signal: { detectedAt: { gte: since } },
      },
    }),
    tx.opportunityScore.findMany({
      where: activeFilter,
      include: { company: true },
      orderBy: { score: "desc" },
      take: 5,
    }),
    tx.opportunityScore.aggregate({ where: activeFilter, _avg: { score: true } }),
    tx.opportunityScore.count({ where: { ...activeFilter, score: { gte: HOT_SCORE_THRESHOLD } } }),
  ]);

  const funnelCounts = await Promise.all(
    FUNNEL_STAGES.map(({ stage }) => tx.opportunityScore.count({ where: { organizationId, stage: stage as never } })),
  );

  const closedTotal = won + lost;
  const conversionRate = closedTotal > 0 ? Math.round((won / closedTotal) * 100) : null;

  const latestMission = await tx.mission.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { opportunityScores: { select: { id: true, status: true, stage: true, score: true } } },
  });
  const mission =
    latestMission && latestMission.opportunityScores.length > 0
      ? {
          createdAt: latestMission.createdAt,
          total: latestMission.opportunityScores.length,
          worked: latestMission.opportunityScores.filter((o) => o.status !== "NEW" || o.stage !== null).length,
          won: latestMission.opportunityScores.filter((o) => o.stage === "VENDIDO").length,
          nextOpportunityId: pickNextMissionOpportunity(latestMission.opportunityScores),
        }
      : null;

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
    mission,
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
    [data, user, organization] = await withOrgContext(organizationId, (tx) =>
      Promise.all([
        fetchDashboardData(tx, organizationId),
        userId ? tx.user.findUnique({ where: { id: userId }, select: { name: true } }) : Promise.resolve(null),
        tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      ]),
    );
  } catch (err) {
    logError("dashboard: falha ao carregar dados", err, { organizationId });
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
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
          Senha atualizada com sucesso.
        </div>
      )}

      <div className="px-4 md:px-10 pt-6">
        <Link
          href="/oportunidades"
          className="rounded-[16px] border p-5 sm:p-6 flex items-center gap-4 no-underline"
          style={{ background: "var(--card)", borderColor: "var(--primary-line)", boxShadow: "var(--shadow-card)", color: "var(--fg)" }}
        >
          <div
            className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <Target size={22} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold m-0 mb-0.5" style={{ textWrap: "balance" }}>
              Empresas que você deveria abordar esta semana
            </h2>
            <p className="m-0 text-[13px]" style={{ color: "var(--fg-muted)" }}>
              {data.active > 0
                ? `${data.active} oportunidade${data.active === 1 ? "" : "s"} esperando por você.`
                : "Rode uma busca pra encontrar suas primeiras oportunidades."}
            </p>
          </div>
          <ArrowRight size={18} strokeWidth={1.75} style={{ color: "var(--fg-faint)" }} className="flex-shrink-0" />
        </Link>
      </div>

      {data.mission && <MissionCard mission={data.mission} />}

      <div className="px-4 md:px-10 pt-4">
        {avgScoreRounded !== null ? (
          <div
            className="rounded-[16px] border p-6 md:p-7 flex flex-col md:flex-row items-center gap-6 md:gap-8"
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
            className="rounded-[16px] border border-dashed p-8 text-center"
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
            {data.best.length === 0 && <EmptyState message="Nenhuma oportunidade ativa ainda." />}
            {data.best.map((opp) => (
              <Link
                key={opp.id}
                href={`/company/${opp.id}`}
                className="flex items-center gap-4 rounded-[16px] border px-4 py-3 no-underline"
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
                      background: pipelineStageColor(f.stage, "var(--primary)"),
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

function MissionCard({
  mission,
}: {
  mission: { createdAt: Date; total: number; worked: number; won: number; nextOpportunityId: string | null };
}) {
  const pct = Math.round((mission.worked / mission.total) * 100);
  const dateLabel = mission.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

  return (
    <div className="px-4 md:px-10 pt-4">
      <div
        className="rounded-[16px] border p-5 sm:p-6"
        style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <Rocket size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase font-semibold" style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}>
              Missão ativa
            </div>
            <div className="text-[14.5px] font-semibold">Missão de {dateLabel}</div>
          </div>
          {mission.won > 0 && (
            <div
              className="flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full px-2.5 py-1 flex-shrink-0"
              style={{ background: "var(--good-soft)", color: "var(--good)" }}
            >
              <Trophy size={12} strokeWidth={2} />
              {mission.won} vendida{mission.won === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            {mission.worked} de {mission.total} oportunidades já em ação
          </span>
          <span className="text-[12.5px] font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
            {pct}%
          </span>
        </div>
        <div className="h-[6px] rounded-full mb-4" style={{ background: "var(--card-hover)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
        </div>

        {mission.nextOpportunityId && (
          <Link
            href={`/assistente-vendas?foco=${mission.nextOpportunityId}`}
            className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold no-underline rounded-[10px] px-4 py-2.5 mb-3 w-full sm:w-auto"
            style={{ background: "var(--primary)", color: "#ffffff" }}
          >
            Fale com 1 empresa hoje
            <ArrowRight size={13} strokeWidth={2} />
          </Link>
        )}
        <div>
          <Link
            href="/oportunidades"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold no-underline"
            style={{ color: "var(--primary)" }}
          >
            Ver oportunidades da missão
            <ArrowRight size={13} strokeWidth={2} />
          </Link>
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
      className="rounded-[16px] border overflow-hidden"
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
