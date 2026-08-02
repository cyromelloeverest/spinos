import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { runSearchAction } from "@/lib/actions/search";
import { SEARCH_COOLDOWN_MS } from "@/lib/opportunity-engine/constants";
import { moveToPipeline, dismissOpportunity } from "@/lib/actions/pipeline";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { SearchButton } from "@/components/SearchButton";

const urgencyStyle: Record<string, { bg: string; color: string; border?: string }> = {
  ALTA: { bg: "var(--copper-soft)", color: "var(--copper)" },
  MEDIA: { bg: "var(--warn-soft)", color: "var(--warn)" },
  BAIXA: { bg: "var(--card-hover)", color: "var(--fg-faint)", border: "var(--border)" },
};

function scoreStyle(score: number) {
  if (score >= 85) return { bg: "var(--copper-soft)", color: "var(--copper)", border: "var(--copper-line)" };
  return { bg: "var(--warn-soft)", color: "var(--warn)", border: "rgba(201,154,61,0.4)" };
}

function fetchOpportunities(organizationId: string) {
  return prisma.opportunityScore.findMany({
    where: { organizationId, stage: null, status: { not: "DISMISSED" } },
    include: { company: true, signalsUsed: { include: { signal: true } } },
    orderBy: { score: "desc" },
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isInFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; count?: string; message?: string; nextAt?: string; senhaAtualizada?: string }>;
}) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    redirect("/onboarding");
  }

  let opportunities: Awaited<ReturnType<typeof fetchOpportunities>> = [];
  let organization: Awaited<ReturnType<typeof prisma.organization.findUnique>> = null;
  let dbError = false;
  try {
    [opportunities, organization] = await Promise.all([
      fetchOpportunities(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);
  } catch {
    dbError = true;
  }

  if (dbError) return <DbSetupNotice />;

  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const lastSearchAt = organization?.lastSearchAt ?? null;
  const nextAvailableAt = lastSearchAt ? new Date(lastSearchAt.getTime() + SEARCH_COOLDOWN_MS) : null;
  const onCooldown = Boolean(nextAvailableAt && isInFuture(nextAvailableAt));
  const searchDisabled = !anthropicConfigured || onCooldown;
  const disabledTitle = !anthropicConfigured
    ? "Configure ANTHROPIC_API_KEY no .env para ativar"
    : onCooldown && nextAvailableAt
      ? `Próxima busca disponível em ${formatDateTime(nextAvailableAt)}`
      : undefined;

  return (
    <div>
      <div className="pt-6 px-10 flex items-baseline justify-between gap-6 flex-wrap">
        <div>
          <h1
            className="text-[25px] font-medium m-0 mb-1"
            style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
          >
            Empresas que você deveria abordar esta semana
          </h1>
          <p className="m-0 text-[13.5px] max-w-[60ch]" style={{ color: "var(--fg-muted)" }}>
            {opportunities.length === 0
              ? "Nenhuma oportunidade ainda — rode uma busca para a IA encontrar sinais reais para o seu ICP."
              : `${opportunities.length} oportunidades calculadas a partir do seu ICP.`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="/export"
            className="text-[12.5px] font-semibold rounded-full border px-4 py-2 whitespace-nowrap no-underline"
            style={{ color: "var(--fg-muted)", borderColor: "var(--border)" }}
          >
            Exportar CSV
          </a>
          <form action={runSearchAction}>
            <SearchButton disabled={searchDisabled} disabledTitle={disabledTitle} />
          </form>
        </div>
      </div>

      {params.search === "not_configured" && (
        <div className="mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Configure a chave ANTHROPIC_API_KEY no arquivo .env para ativar a busca automática.
        </div>
      )}
      {params.search === "rate_limited" && (
        <div className="mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Já rodamos uma busca recentemente (limite de 1 a cada 2 dias, pra não gastar à toa). Próxima disponível em{" "}
          {params.nextAt ? formatDateTime(new Date(params.nextAt)) : "breve"}.
        </div>
      )}
      {params.search === "error" && (
        <div className="mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
          {params.message ?? "Erro ao buscar oportunidades."}
        </div>
      )}
      {params.search === "ok" && (
        <div className="mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--good)", color: "var(--good)" }}>
          {params.count} oportunidade(s) encontrada(s) e adicionada(s).
        </div>
      )}
      {params.senhaAtualizada && (
        <div className="mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--good)", color: "var(--good)" }}>
          Senha atualizada com sucesso.
        </div>
      )}

      <div className="px-10 pt-6 pb-16 flex flex-col gap-2.5 max-w-[880px]">
        {opportunities.map((opp) => {
          const uStyle = urgencyStyle[opp.urgency];
          const sStyle = scoreStyle(opp.score);
          const isNew = Boolean(lastSearchAt && opp.computedAt.getTime() === lastSearchAt.getTime());
          return (
            <div
              key={opp.id}
              className="flex items-center gap-5 rounded-xl border p-5"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--fg)",
              }}
            >
              <Link href={`/company/${opp.id}`} className="flex items-center gap-5 flex-1 min-w-0 no-underline" style={{ color: "var(--fg)" }}>
                <div
                  className="w-16 h-16 rounded-[10px] flex items-center justify-center border font-semibold text-[26px] flex-shrink-0"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    background: sStyle.bg,
                    color: sStyle.color,
                    borderColor: sStyle.border,
                  }}
                >
                  {opp.score}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="text-[15.5px] font-semibold">{opp.company.name}</div>
                    <div className="text-[12px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>
                      {opp.company.city}, {opp.company.state}
                    </div>
                  </div>
                  <div className="text-[13px] mb-2.5 leading-[1.5]" style={{ color: "var(--fg-muted)" }}>
                    {opp.headline}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {opp.signalsUsed.slice(0, 4).map(({ signal }) => (
                      <div
                        key={signal.id}
                        className="text-[11.5px] rounded-[6px] border px-2 py-[3px] flex items-center gap-1 whitespace-nowrap"
                        style={{ color: "var(--fg-muted)", borderColor: "var(--border)" }}
                      >
                        <span style={{ color: "var(--good)", fontSize: "10px" }}>✔</span>
                        {signal.title}
                      </div>
                    ))}
                  </div>
                </div>
              </Link>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  {isNew && (
                    <div
                      className="text-[10px] font-semibold rounded-full px-2 py-1"
                      style={{ background: "var(--good-soft)", color: "var(--good)" }}
                    >
                      NOVO
                    </div>
                  )}
                  <div
                    className="text-[11px] font-semibold rounded-full px-2.5 py-1 border"
                    style={{ background: uStyle.bg, color: uStyle.color, borderColor: uStyle.border ?? "transparent" }}
                  >
                    {opp.urgency}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <form action={moveToPipeline.bind(null, opp.id)}>
                    <button
                      type="submit"
                      title="Mover para o pipeline"
                      className="text-[11px] font-semibold rounded-full px-2.5 py-1 border cursor-pointer"
                      style={{ background: "var(--copper-soft)", color: "var(--copper)", borderColor: "transparent" }}
                    >
                      → Pipeline
                    </button>
                  </form>
                  <form action={dismissOpportunity.bind(null, opp.id)}>
                    <button
                      type="submit"
                      title="Descartar"
                      className="text-[11px] rounded-full w-[26px] h-[26px] border cursor-pointer flex items-center justify-center"
                      style={{ color: "var(--fg-faint)", borderColor: "var(--border)" }}
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
