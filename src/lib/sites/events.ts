import "server-only";
import { prismaAdmin } from "@/lib/prisma-admin";

export type PublicSiteEvent = {
  organizationId: string;
  siteId: string;
  kind: "view" | "click" | "vitals";
  path: string;
  visitor: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: string;
  country: string | null;
  label: string | null;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  ttfb: number | null;
  fcp: number | null;
};

const KIND = { view: "VIEW", click: "CLICK", vitals: "VITALS" } as const;

// Visitante anônimo, sem cookie: grava só o que o beacon manda (nunca IP). Usa o papel
// administrativo porque quem visita não tem organização no contexto.
export async function saveSiteEvent(e: PublicSiteEvent): Promise<void> {
  await prismaAdmin.siteEvent.create({
    data: {
      organizationId: e.organizationId,
      siteId: e.siteId,
      type: KIND[e.kind],
      path: e.path,
      visitorHash: e.visitor,
      referrerHost: e.referrerHost,
      utmSource: e.utmSource,
      utmMedium: e.utmMedium,
      utmCampaign: e.utmCampaign,
      device: e.device,
      country: e.country,
      label: e.label,
      lcp: e.lcp,
      inp: e.inp,
      cls: e.cls,
      ttfb: e.ttfb,
      fcp: e.fcp,
    },
  });
}

/*
 * Limites do formulário de contato. Por visitante e por site: uma pessoa manda um ou dois
 * formulários, então 5 em dez minutos já deixa folga para um escritório que divide o
 * mesmo IP. Por site: limita o que uma enxurrada espalhada empurra para a caixa de um
 * cliente. Contado nos próprios eventos FORM, então vale entre instâncias.
 */
const LEAD_LIMITS = { perVisitor: { limit: 5, windowMs: 10 * 60_000 }, perSite: { limit: 200, windowMs: 60 * 60_000 } };

/** Falso quando esse visitante (ou o site inteiro) está mandando formulários demais. Falha aberta. */
export async function allowLead(siteId: string, ipHash: string | null): Promise<boolean> {
  try {
    const now = Date.now();
    if (ipHash) {
      const n = await prismaAdmin.siteEvent.count({ where: { siteId, type: "FORM", visitorHash: ipHash, createdAt: { gte: new Date(now - LEAD_LIMITS.perVisitor.windowMs) } } });
      if (n >= LEAD_LIMITS.perVisitor.limit) return false;
    }
    const total = await prismaAdmin.siteEvent.count({ where: { siteId, type: "FORM", createdAt: { gte: new Date(now - LEAD_LIMITS.perSite.windowMs) } } });
    return total < LEAD_LIMITS.perSite.limit;
  } catch (error) {
    // Perder um lead de verdade custa mais que alguns de spam.
    console.error("[rate-limit] contador indisponível, lead liberado", error);
    return true;
  }
}
