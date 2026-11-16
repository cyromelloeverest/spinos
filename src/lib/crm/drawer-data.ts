import type { Prisma } from "@/generated/prisma/client";
import { getDefaultPipeline } from "./pipeline-config";

type Tx = Prisma.TransactionClient;

// Tudo que a gaveta da oportunidade mostra, numa leitura só.
export async function getDrawerData(tx: Tx, organizationId: string, scoreId: string) {
  const score = await tx.opportunityScore.findFirst({
    where: { id: scoreId, organizationId },
    include: {
      company: true,
      account: {
        include: {
          contacts: { where: { anonymizedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          origins: { where: { isFirstTouch: true }, take: 1 },
          opportunities: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              stage: true,
              stageEvents: { orderBy: { createdAt: "desc" }, take: 20, include: { toStage: true } },
              activities: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
            },
          },
        },
      },
    },
  });
  if (!score) return null;

  const members = await tx.membership.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true } } } });
  const pipeline = await getDefaultPipeline(tx, organizationId);
  const deal = score.account?.opportunities[0] ?? null;
  const owner = deal?.ownerUserId ? members.find((m) => m.userId === deal.ownerUserId)?.user ?? null : null;

  return {
    score,
    company: score.company,
    contacts: score.account?.contacts ?? [],
    originChannel: score.account?.origins[0]?.channel ?? null,
    deal,
    stages: pipeline.stages,
    members: members.map((m) => ({ id: m.user.id, name: m.user.name || m.user.email })),
    owner,
  };
}

export type DrawerData = NonNullable<Awaited<ReturnType<typeof getDrawerData>>>;
