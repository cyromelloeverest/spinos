import type { Prisma } from "@/generated/prisma/client";
import { startOfDayBRT, endOfDayBRT } from "./dates";

type Tx = Prisma.TransactionClient;

export type Attention = {
  overdue: number;
  today: number;
  noNextStep: number;
  openCount: number;
  openValueBRL: number;
  wonLast30dCount: number;
  wonLast30dValueBRL: number;
};

// Números da faixa do topo do pipeline. `ownerUserId` filtra "Minhas"; sem ele é
// "Toda a equipe". Uma atividade é da pessoa se ela é a responsável pela atividade
// (ou, na falta, pela negociação).
export async function getAttention(tx: Tx, organizationId: string, ownerUserId: string | null, now: Date = new Date()): Promise<Attention> {
  const mineActivity: Prisma.ActivityWhereInput = ownerUserId
    ? { OR: [{ ownerUserId }, { ownerUserId: null, opportunity: { is: { OR: [{ ownerUserId }, { ownerUserId: null }] } } }] }
    : {};
  // Negociação sem dono é de todo mundo: aparece em "Minhas" até alguém assumir.
  const mineOpp: Prisma.OpportunityWhereInput = ownerUserId ? { OR: [{ ownerUserId }, { ownerUserId: null }] } : {};
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [overdue, today, noNextStep, open, won] = await Promise.all([
    tx.activity.count({ where: { organizationId, status: "OPEN", dueAt: { lt: startOfDayBRT(now) }, ...mineActivity } }),
    tx.activity.count({ where: { organizationId, status: "OPEN", dueAt: { gte: startOfDayBRT(now), lt: endOfDayBRT(now) }, ...mineActivity } }),
    tx.opportunity.count({ where: { organizationId, status: "OPEN", nextActivityAt: null, ...mineOpp } }),
    tx.opportunity.aggregate({ where: { organizationId, status: "OPEN", ...mineOpp }, _count: { _all: true }, _sum: { expectedValueBRL: true } }),
    tx.opportunity.aggregate({ where: { organizationId, status: "WON", closedAt: { gte: since }, ...mineOpp }, _count: { _all: true }, _sum: { wonValueBRL: true, expectedValueBRL: true } }),
  ]);

  return {
    overdue,
    today,
    noNextStep,
    openCount: open._count._all,
    openValueBRL: open._sum.expectedValueBRL ?? 0,
    wonLast30dCount: won._count._all,
    wonLast30dValueBRL: won._sum.wonValueBRL ?? won._sum.expectedValueBRL ?? 0,
  };
}
