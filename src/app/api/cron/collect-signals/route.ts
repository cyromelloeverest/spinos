import { ingestFreeSignals } from "@/lib/free-signals/ingest";
import { matchFreeSignalsToOrganizations } from "@/lib/free-signals/match";
import { logError } from "@/lib/log-error";

// Vercel Cron injeta este header automaticamente quando CRON_SECRET está
// configurado no projeto — nenhuma outra chamada (nem de dentro do app)
// deveria conseguir disparar essa rota, ela não pertence a organização
// nenhuma e roda IA em nome de todo mundo.
function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// 60s cobre o cenário atual (poucas dezenas de organizações); se a base
// crescer bastante, vale paralelizar o loop por org em match.ts antes de
// simplesmente subir esse número.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const ingested = await ingestFreeSignals();
    await matchFreeSignalsToOrganizations(ingested);
    return Response.json({ status: "ok", signalsIngested: ingested.length });
  } catch (err) {
    logError("cron/collect-signals: falha na coleta gratuita", err);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
