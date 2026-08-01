import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { organization, icp, opportunities } from "../src/lib/seed-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "sakatec" },
    update: {},
    create: {
      id: "sakatec",
      name: organization.name,
      site: organization.site,
      city: organization.city,
      state: organization.state,
      segment: organization.segment,
    },
  });

  const orgIcp = await prisma.iCP.upsert({
    where: { id: "sakatec-icp" },
    update: {},
    create: {
      id: "sakatec-icp",
      organizationId: org.id,
      name: "ICP Principal",
      segments: icp.segments,
      radiusKm: icp.radiusKm,
      servicesSold: icp.services,
      decisionMakerTitles: icp.decisionMakerTitles,
      states: ["SP"],
      cities: [],
      technologies: [],
      keywords: [],
      productsSold: [],
    },
  });

  for (const opp of opportunities) {
    const company = await prisma.company.upsert({
      where: { id: opp.id },
      update: {},
      create: {
        id: opp.id,
        name: opp.name,
        city: opp.city,
        state: opp.state,
      },
    });

    const score = await prisma.opportunityScore.upsert({
      where: {
        organizationId_companyId_icpId: {
          organizationId: org.id,
          companyId: company.id,
          icpId: orgIcp.id,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        companyId: company.id,
        icpId: orgIcp.id,
        score: opp.score,
        urgency: opp.urgency.toUpperCase() as "ALTA" | "MEDIA" | "BAIXA",
        headline: opp.headline,
        execSummary: opp.execSummary,
        reasoning: opp.reasoning,
        buyerArea: opp.buyerArea,
        decisionMaker: opp.decisionMaker,
        suggestedApproach: opp.approach,
        commercialArguments: opp.arguments,
        objections: opp.objections,
      },
    });

    for (const s of opp.signals) {
      const signal = await prisma.signal.create({
        data: {
          companyId: company.id,
          category: "OTHER",
          sourceType: "manual_research",
          sourceUrl: s.sourceUrl,
          title: s.category,
          description: s.text,
          detectedAt: new Date(),
        },
      });
      await prisma.opportunityScoreSignal.create({
        data: { opportunityScoreId: score.id, signalId: signal.id },
      });
    }
  }

  console.log(`Seed completo: organização "${org.name}" com ${opportunities.length} oportunidades.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
