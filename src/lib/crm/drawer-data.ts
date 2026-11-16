import type { Prisma } from "@/generated/prisma/client";
import { getDefaultPipeline } from "./pipeline-config";

type Tx = Prisma.TransactionClient;

// Tudo que a gaveta da oportunidade mostra, numa leitura só.
const ACCOUNT_INCLUDE = {
  contacts: { where: { anonymizedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
  origins: { where: { isFirstTouch: true }, take: 1 },
  scores: { select: { id: true }, take: 1 },
  opportunities: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      stage: true,
      stageEvents: { orderBy: { createdAt: "desc" }, take: 20, include: { toStage: true } },
      activities: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
    },
  },
} satisfies Prisma.AccountInclude;

// Tudo que a gaveta da oportunidade mostra, numa leitura só. A referência é o id da
// nota (oportunidade encontrada pela IA) ou da negociação (lead sem nota).
export async function getDrawerData(tx: Tx, organizationId: string, ref: string) {
  const score = await tx.opportunityScore.findFirst({ where: { id: ref, organizationId }, include: { company: true, account: { include: ACCOUNT_INCLUDE } } });
  let account = score?.account ?? null;
  if (!score) {
    const direct = await tx.opportunity.findFirst({ where: { id: ref, organizationId }, select: { accountId: true } });
    if (!direct) return null;
    account = await tx.account.findFirst({ where: { id: direct.accountId, organizationId }, include: ACCOUNT_INCLUDE });
  }
  // Nota ainda sem conta (nunca foi trabalhada): a gaveta mostra só o convite para mover ao pipeline.
  if (!account && !score) return null;

  const members = await tx.membership.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true } } } });
  const pipeline = await getDefaultPipeline(tx, organizationId);
  const deal = account?.opportunities[0] ?? null;
  const owner = deal?.ownerUserId ? members.find((m) => m.userId === deal.ownerUserId)?.user ?? null : null;

  return {
    // Nome e local vêm da empresa (nota) ou da própria conta (lead).
    company: { name: score?.company.name ?? account?.name ?? "", city: score?.company.city ?? account?.city ?? null, state: score?.company.state ?? account?.state ?? null },
    scoreId: score?.id ?? account?.scores[0]?.id ?? null,
    contacts: account?.contacts ?? [],
    originChannel: account?.origins[0]?.channel ?? null,
    deal,
    stages: pipeline.stages,
    members: members.map((m) => ({ id: m.user.id, name: m.user.name || m.user.email })),
    owner,
  };
}

export type DrawerData = NonNullable<Awaited<ReturnType<typeof getDrawerData>>>;
