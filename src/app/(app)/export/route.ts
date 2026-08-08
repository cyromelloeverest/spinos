import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { getPlan } from "@/lib/plans";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return new Response("Nenhuma organização ativa.", { status: 400 });
  }

  const result = await withOrgContext(organizationId, async (tx) => {
    const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { plan: true } });
    const plan = getPlan(organization?.plan ?? "STARTER");
    if (!plan.features.crmExport) return { allowed: false as const, plan };

    const opportunities = await tx.opportunityScore.findMany({
      where: { organizationId },
      include: { company: true },
      orderBy: { score: "desc" },
    });
    return { allowed: true as const, opportunities };
  });

  if (!result.allowed) {
    return new Response(
      `Exportação disponível a partir do plano Profissional. Seu plano atual é ${result.plan.name}.`,
      { status: 403 },
    );
  }
  const { opportunities } = result;

  const header = [
    "Empresa",
    "Cidade",
    "Estado",
    "Score",
    "Urgência",
    "Etapa do pipeline",
    "Resumo",
    "Decisor provável",
    "Como abordar",
  ];

  const rows = opportunities.map((opp) =>
    [
      opp.company.name,
      opp.company.city ?? "",
      opp.company.state ?? "",
      String(opp.score),
      opp.urgency,
      opp.stage ?? "Não iniciado",
      opp.headline,
      opp.decisionMaker ?? "",
      opp.suggestedApproach,
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="oportunidades.csv"`,
    },
  });
}
