import type { Prisma } from "@/generated/prisma/client";
import { originLabel } from "@/lib/crm/origin-options";

type Tx = Prisma.TransactionClient;

/*
 * Relatório de marketing "da origem ao contrato": cada negociação carrega a origem do primeiro
 * toque da conta (site, anúncio, indicação, prospecção…); o investimento é lançado à mão (ou por
 * CSV) em campanhas; o tráfego do site vem do contador próprio, sem cookie. Tudo com a mesma
 * janela de datas, para os números conversarem entre si.
 */

export type PeriodKey = "7d" | "30d" | "90d" | "mes" | "ano";
export const PERIOD_LABEL: Record<PeriodKey, string> = { "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias", mes: "Este mês", ano: "Este ano" };
export type Period = { key: PeriodKey; from: Date; to: Date };

const DAY = 24 * 60 * 60 * 1000;
const BRT = 3 * 60 * 60 * 1000;

export function parsePeriodKey(v: string | undefined): PeriodKey {
  return v && v in PERIOD_LABEL ? (v as PeriodKey) : "30d";
}

// Janelas fechadas no início e abertas no fim, em horário de Brasília.
export function resolvePeriod(key: PeriodKey, now: Date = new Date()): Period {
  const local = new Date(now.getTime() - BRT);
  const startOfToday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BRT);
  const to = new Date(startOfToday.getTime() + DAY);
  switch (key) {
    case "7d":
      return { key, from: new Date(to.getTime() - 7 * DAY), to };
    case "30d":
      return { key, from: new Date(to.getTime() - 30 * DAY), to };
    case "90d":
      return { key, from: new Date(to.getTime() - 90 * DAY), to };
    case "mes":
      return { key, from: new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + BRT), to };
    case "ano":
      return { key, from: new Date(Date.UTC(local.getUTCFullYear(), 0, 1) + BRT), to };
  }
}

export type ChannelRow = {
  channel: string;
  label: string;
  leads: number;
  open: number;
  won: number;
  lost: number;
  /** Ganhas sobre o total de negociações do canal no período (null sem negociações). */
  conversion: number | null;
  wonValueBRL: number;
  avgTicketBRL: number | null;
  spendBRL: number;
  /** null quando não há investimento lançado para o canal. */
  costPerLeadBRL: number | null;
  cacBRL: number | null;
};

export type MarketingReport = {
  period: Period;
  totals: { leads: number; won: number; lost: number; open: number; wonValueBRL: number; spendBRL: number; conversion: number | null; cacBRL: number | null };
  channels: ChannelRow[];
  lossReasons: { label: string; count: number }[];
  response: { answered: number; unanswered: number; medianMinutes: number | null; avgMinutes: number | null };
  campaigns: { id: string; name: string; channel: string | null; label: string; spendBRL: number; startsAt: Date | null; leads: number; won: number }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export async function marketingReport(tx: Tx, organizationId: string, period: Period): Promise<MarketingReport> {
  const created = { gte: period.from, lt: period.to };
  const deals = await tx.opportunity.findMany({
    where: { organizationId, createdAt: created },
    select: { id: true, accountId: true, status: true, wonValueBRL: true, expectedValueBRL: true, campaignId: true, firstResponseAt: true, createdAt: true, lossReason: { select: { label: true } } },
    take: 20000,
  });
  const accountIds = [...new Set(deals.map((d) => d.accountId))];
  const firstTouches = accountIds.length
    ? await tx.origin.findMany({ where: { organizationId, accountId: { in: accountIds }, isFirstTouch: true }, select: { accountId: true, channel: true } })
    : [];
  const channelOf = new Map(firstTouches.map((o) => [o.accountId, o.channel ?? "outro"]));

  // Investimento: campanhas que começaram na janela (sem data de início, a de criação).
  const campaigns = await tx.campaign.findMany({
    where: { organizationId, spendBRL: { not: null }, OR: [{ startsAt: created }, { startsAt: null, createdAt: created }] },
    select: { id: true, name: true, channel: true, spendBRL: true, startsAt: true, createdAt: true },
    orderBy: { startsAt: "desc" },
  });

  const byChannel = new Map<string, ChannelRow>();
  const row = (channel: string): ChannelRow => {
    let r = byChannel.get(channel);
    if (!r) {
      r = { channel, label: originLabel(channel), leads: 0, open: 0, won: 0, lost: 0, conversion: null, wonValueBRL: 0, avgTicketBRL: null, spendBRL: 0, costPerLeadBRL: null, cacBRL: null };
      byChannel.set(channel, r);
    }
    return r;
  };
  const reasons = new Map<string, number>();
  const responseMinutes: number[] = [];
  let unanswered = 0;
  for (const d of deals) {
    const r = row(channelOf.get(d.accountId) ?? "outro");
    r.leads += 1;
    if (d.status === "OPEN") r.open += 1;
    if (d.status === "WON") {
      r.won += 1;
      r.wonValueBRL += d.wonValueBRL ?? d.expectedValueBRL ?? 0;
    }
    if (d.status === "LOST") {
      r.lost += 1;
      const label = d.lossReason?.label ?? "Sem motivo informado";
      reasons.set(label, (reasons.get(label) ?? 0) + 1);
    }
    if (d.firstResponseAt) responseMinutes.push(Math.max(0, (d.firstResponseAt.getTime() - d.createdAt.getTime()) / 60000));
    else if (d.status === "OPEN") unanswered += 1;
  }
  for (const c of campaigns) {
    if (c.channel) row(c.channel).spendBRL += c.spendBRL ?? 0;
  }
  const channels = [...byChannel.values()].map((r) => ({
    ...r,
    wonValueBRL: round2(r.wonValueBRL),
    spendBRL: round2(r.spendBRL),
    conversion: r.leads > 0 ? r.won / r.leads : null,
    avgTicketBRL: r.won > 0 ? round2(r.wonValueBRL / r.won) : null,
    costPerLeadBRL: r.spendBRL > 0 && r.leads > 0 ? round2(r.spendBRL / r.leads) : null,
    cacBRL: r.spendBRL > 0 && r.won > 0 ? round2(r.spendBRL / r.won) : null,
  }));
  channels.sort((a, b) => b.leads - a.leads || b.wonValueBRL - a.wonValueBRL);

  const sum = (f: (r: ChannelRow) => number) => channels.reduce((n, r) => n + f(r), 0);
  const leads = sum((r) => r.leads);
  const won = sum((r) => r.won);
  // O investimento total inclui campanhas sem canal, que não aparecem na tabela por canal.
  const spendBRL = round2(campaigns.reduce((n, c) => n + (c.spendBRL ?? 0), 0));

  const perCampaign = new Map<string, { leads: number; won: number }>();
  for (const d of deals) {
    if (!d.campaignId) continue;
    const c = perCampaign.get(d.campaignId) ?? { leads: 0, won: 0 };
    c.leads += 1;
    if (d.status === "WON") c.won += 1;
    perCampaign.set(d.campaignId, c);
  }

  return {
    period,
    totals: { leads, won, lost: sum((r) => r.lost), open: sum((r) => r.open), wonValueBRL: round2(sum((r) => r.wonValueBRL)), spendBRL, conversion: leads > 0 ? won / leads : null, cacBRL: spendBRL > 0 && won > 0 ? round2(spendBRL / won) : null },
    channels,
    lossReasons: [...reasons.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    response: { answered: responseMinutes.length, unanswered, medianMinutes: median(responseMinutes), avgMinutes: responseMinutes.length ? responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length : null },
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, channel: c.channel, label: c.channel ? originLabel(c.channel) : "Sem canal", spendBRL: c.spendBRL ?? 0, startsAt: c.startsAt ?? c.createdAt, ...(perCampaign.get(c.id) ?? { leads: 0, won: 0 }) })),
  };
}

export type SiteTraffic = {
  hasSite: boolean;
  views: number;
  visitors: number;
  whatsappClicks: number;
  phoneClicks: number;
  emailClicks: number;
  forms: number;
  /** Envios de formulário sobre visitantes (null sem visitantes). */
  formRate: number | null;
  topPages: { path: string; views: number }[];
  topSources: { source: string; visitors: number }[];
};

export async function siteTraffic(tx: Tx, organizationId: string, period: Period): Promise<SiteTraffic> {
  const hasSite = (await tx.site.count({ where: { organizationId } })) > 0;
  const empty: SiteTraffic = { hasSite, views: 0, visitors: 0, whatsappClicks: 0, phoneClicks: 0, emailClicks: 0, forms: 0, formRate: null, topPages: [], topSources: [] };
  if (!hasSite) return empty;
  const where = { organizationId, createdAt: { gte: period.from, lt: period.to } };

  const byType = await tx.siteEvent.groupBy({ by: ["type", "label"], where, _count: { _all: true } });
  const count = (type: string, label?: string) => byType.filter((g) => g.type === type && (label === undefined || g.label === label)).reduce((n, g) => n + g._count._all, 0);
  const views = count("VIEW");
  // Formulário: só o que virou lead (spam fica de fora).
  const forms = count("FORM", "lead");

  const visitorsRows = await tx.$queryRaw<{ n: number }[]>`SELECT COUNT(DISTINCT "visitorHash")::int AS n FROM site_events WHERE "organizationId" = ${organizationId} AND type = 'VIEW' AND "createdAt" >= ${period.from} AND "createdAt" < ${period.to}`;
  const visitors = visitorsRows[0]?.n ?? 0;

  const pages = await tx.siteEvent.groupBy({ by: ["path"], where: { ...where, type: "VIEW" }, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 5 });
  const sources = await tx.$queryRaw<{ source: string; n: number }[]>`SELECT COALESCE(NULLIF("utmSource", ''), NULLIF("referrerHost", ''), 'Direto') AS source, COUNT(DISTINCT "visitorHash")::int AS n FROM site_events WHERE "organizationId" = ${organizationId} AND type = 'VIEW' AND "createdAt" >= ${period.from} AND "createdAt" < ${period.to} GROUP BY 1 ORDER BY 2 DESC LIMIT 5`;

  return {
    hasSite,
    views,
    visitors,
    whatsappClicks: count("CLICK", "whatsapp"),
    phoneClicks: count("CLICK", "phone"),
    emailClicks: count("CLICK", "email"),
    forms,
    formRate: visitors > 0 ? forms / visitors : null,
    topPages: pages.map((p) => ({ path: p.path ?? "/", views: p._count._all })),
    topSources: sources.map((s) => ({ source: s.source, visitors: s.n })),
  };
}
