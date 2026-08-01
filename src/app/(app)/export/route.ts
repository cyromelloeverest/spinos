import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";

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

  const opportunities = await prisma.opportunityScore.findMany({
    where: { organizationId },
    include: { company: true },
    orderBy: { score: "desc" },
  });

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
