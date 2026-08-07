import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/log-error";

// Chance de podar tentativas com mais de 24h a cada chamada, em vez de um
// cron dedicado — mantém a tabela pequena sem precisar de infra extra.
const PRUNE_PROBABILITY = 0.02;
const PRUNE_AGE_MS = 24 * 60 * 60 * 1000;

type RateLimitAction = "signin" | "signup" | "password-reset";

const LIMITS: Record<RateLimitAction, { windowMs: number; maxAttempts: number }> = {
  signin: { windowMs: 15 * 60 * 1000, maxAttempts: 10 },
  signup: { windowMs: 60 * 60 * 1000, maxAttempts: 8 },
  "password-reset": { windowMs: 60 * 60 * 1000, maxAttempts: 5 },
};

export async function getClientIp(): Promise<string> {
  const h = await headers();
  // Vercel sempre popula x-forwarded-for com o IP real do cliente primeiro
  // na lista, mesmo atrás do proxy deles.
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

// Retorna true se a ação deve ser bloqueada por excesso de tentativas
// recentes vindas do mesmo IP. Não lança e não distingue "erro no banco" de
// "sem limite" — se o rate limit falhar, deixa passar (fail-open) em vez de
// derrubar login pra todo mundo por um problema no Postgres.
export async function isRateLimited(action: RateLimitAction): Promise<boolean> {
  const { windowMs, maxAttempts } = LIMITS[action];
  const ip = await getClientIp();
  const identifier = `${action}:${ip}`;

  try {
    const count = await prisma.authAttempt.count({
      where: { identifier, createdAt: { gte: new Date(Date.now() - windowMs) } },
    });
    return count >= maxAttempts;
  } catch (err) {
    logError("rate-limit: falha ao checar tentativas (fail-open, deixando passar)", err, { action });
    return false;
  }
}

// Nome neutro de propósito: para signin/signup só é chamada no branch de erro
// (pra não penalizar quem erra a senha uma vez), mas para password-reset é
// chamada em toda tentativa, sucesso ou não — ver comentário no call site.
export async function recordAttempt(action: RateLimitAction): Promise<void> {
  const ip = await getClientIp();
  const identifier = `${action}:${ip}`;

  try {
    await prisma.authAttempt.create({ data: { identifier } });
    if (Math.random() < PRUNE_PROBABILITY) {
      await prisma.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - PRUNE_AGE_MS) } } });
    }
  } catch (err) {
    // Rate limiting é defesa em profundidade, não pode derrubar o fluxo de auth.
    logError("rate-limit: falha ao gravar tentativa", err, { action });
  }
}
