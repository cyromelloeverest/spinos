import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { EmptyState } from "@/components/EmptyState";
import { ScriptCard } from "@/components/ScriptCard";
import { buildSalesScript } from "@/lib/sales-script";
import { logError } from "@/lib/log-error";

function fetchActiveOpportunities(tx: Prisma.TransactionClient, organizationId: string) {
  return tx.opportunityScore.findMany({
    where: {
      organizationId,
      status: { not: "DISMISSED" },
      // NOT stage: { notIn: [...] } de propósito — em SQL, "NOT IN" com uma
      // coluna que tem valor NULL nunca dá true (lógica de 3 valores), então
      // toda oportunidade recém-criada (stage ainda null, o caso mais comum
      // de "oportunidade nova") sumia daqui. OR explícito com null resolve.
      OR: [{ stage: null }, { stage: { notIn: ["VENDIDO", "PERDIDO"] } }],
    },
    include: { company: true },
    orderBy: { score: "desc" },
  });
}

export default async function ScriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ foco?: string }>;
}) {
  const { foco } = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let opportunities: Awaited<ReturnType<typeof fetchActiveOpportunities>> = [];
  let organization: Prisma.OrganizationModel | null = null;
  let dbError = false;
  try {
    [opportunities, organization] = await withOrgContext(organizationId, (tx) =>
      Promise.all([
        fetchActiveOpportunities(tx, organizationId),
        tx.organization.findUnique({ where: { id: organizationId } }),
      ]),
    );
  } catch (err) {
    logError("assistente-vendas: falha ao carregar oportunidades", err, { organizationId });
    dbError = true;
  }
  if (dbError) return <DbSetupNotice />;

  const orgName = organization?.name ?? "sua empresa";

  // Quem chegou aqui a partir do card "Fale com 1 empresa hoje" do
  // dashboard espera ver aquela oportunidade específica primeiro, já
  // aberta — não garimpar ela numa lista ordenada só por score.
  if (foco) {
    const idx = opportunities.findIndex((o) => o.id === foco);
    if (idx > 0) {
      const [focused] = opportunities.splice(idx, 1);
      opportunities.unshift(focused);
    }
  }

  return (
    <div>
      <div className="pt-6 px-4 md:px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Assistente de Vendas
        </h1>
        <p className="m-0 text-[13.5px] max-w-[60ch]" style={{ color: "var(--fg-muted)" }}>
          Um roteiro pronto pra cada oportunidade — o que falar, pra quem, e como responder às objeções mais prováveis.
        </p>
      </div>

      <div className="px-4 md:px-10 pt-6 pb-16 flex flex-col gap-2.5 max-w-[720px]">
        {opportunities.length === 0 && <EmptyState message="Nenhuma oportunidade ativa no momento." />}

        {opportunities.map((opp) => {
          const script = buildSalesScript({
            companyName: opp.company.name,
            headline: opp.headline,
            execSummary: opp.execSummary,
            suggestedApproach: opp.suggestedApproach,
            commercialArguments: opp.commercialArguments,
            objections: opp.objections,
            buyerArea: opp.buyerArea,
            decisionMaker: opp.decisionMaker,
            contactName: opp.contactName,
            recommendedOffering: opp.recommendedOffering,
            orgName,
          });
          return (
            <ScriptCard
              key={opp.id}
              companyName={opp.company.name}
              city={opp.company.city}
              state={opp.company.state}
              score={opp.score}
              script={script}
              personName={opp.contactName || opp.decisionMakerName}
              personTitle={opp.decisionMaker}
              highlighted={opp.id === foco}
            />
          );
        })}
      </div>
    </div>
  );
}
