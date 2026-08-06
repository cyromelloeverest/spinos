import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { EmptyState } from "@/components/EmptyState";
import { ScriptCard } from "@/components/ScriptCard";
import { buildSalesScript } from "@/lib/sales-script";

function fetchActiveOpportunities(organizationId: string) {
  return prisma.opportunityScore.findMany({
    where: {
      organizationId,
      status: { not: "DISMISSED" },
      stage: { notIn: ["VENDIDO", "PERDIDO"] },
    },
    include: { company: true },
    orderBy: { score: "desc" },
  });
}

export default async function ScriptsPage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let opportunities: Awaited<ReturnType<typeof fetchActiveOpportunities>> = [];
  let organization: Awaited<ReturnType<typeof prisma.organization.findUnique>> = null;
  let dbError = false;
  try {
    [opportunities, organization] = await Promise.all([
      fetchActiveOpportunities(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);
  } catch {
    dbError = true;
  }
  if (dbError) return <DbSetupNotice />;

  const orgName = organization?.name ?? "sua empresa";

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
            />
          );
        })}
      </div>
    </div>
  );
}
