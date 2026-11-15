import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prismaAdmin } from "@/lib/prisma-admin";
import { getClientIp } from "@/lib/auth/rate-limit";
import { sendOrganizationDeletedAlert, sendMfaDisabledAlert, sendBruteForceAlert } from "@/lib/security-alert-email";

// security_events fica fora do escopo das policies de RLS por tenant de
// propósito (é log de auditoria cross-org, só o /admin lê) — por isso usa
// prismaAdmin, não a conexão restrita.

export type SecurityEventType =
  | "auth.signin_success"
  | "auth.signin_failed"
  | "auth.signup"
  | "auth.signout"
  | "auth.password_reset_requested"
  | "auth.password_updated"
  | "admin.plan_changed"
  | "admin.trial_extended"
  | "admin.trial_limit_removed"
  | "admin.user_invited"
  | "admin.user_removed"
  | "admin.invite_canceled"
  | "admin.search_block_toggled"
  | "admin.agency_access_granted"
  | "privacy.data_exported"
  | "privacy.deletion_requested"
  | "privacy.deletion_completed"
  | "privacy.third_party_data_redacted"
  | "team.member_invited"
  | "team.member_removed"
  | "team.invite_canceled"
  | "team.invite_accepted"
  | "auth.mfa_enrolled"
  | "auth.mfa_disabled"
  | "auth.mfa_challenge_succeeded"
  | "auth.mfa_challenge_failed"
  | "auth.password_reset_code_verified"
  | "auth.password_reset_code_failed";

type LogInput = {
  type: SecurityEventType;
  actorUserId?: string | null;
  actorEmail?: string | null;
  organizationId?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

// Eventos que sempre valem um e-mail na hora — raros e de consequência alta
// o bastante pra não precisar de nenhum agrupamento/limite (ver ALWAYS_ALERT
// abaixo). auth.signin_failed é tratado à parte, por contagem, não por tipo.
const ALWAYS_ALERT_TYPES = new Set<SecurityEventType>(["privacy.deletion_completed", "auth.mfa_disabled"]);

const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000;
// Alerta some pontos abaixo do bloqueio automático do rate limit (10 em
// 15min, ver src/lib/auth/rate-limit.ts) — dá visibilidade antes/durante,
// não só depois que o IP já foi barrado.
const BRUTE_FORCE_ALERT_THRESHOLD = 5;

async function maybeSendAlert(input: LogInput, ip: string): Promise<void> {
  if (ALWAYS_ALERT_TYPES.has(input.type)) {
    if (input.type === "privacy.deletion_completed") {
      await sendOrganizationDeletedAlert({
        organizationName: (input.metadata as { organizationName?: string } | undefined)?.organizationName ?? "desconhecida",
        organizationId: input.targetId ?? "desconhecido",
      });
    } else if (input.type === "auth.mfa_disabled") {
      await sendMfaDisabledAlert({ actorEmail: input.actorEmail ?? null, actorUserId: input.actorUserId ?? null });
    }
    return;
  }

  if (input.type === "auth.signin_failed" && ip !== "unknown") {
    const count = await prismaAdmin.securityEvent.count({
      where: { type: "auth.signin_failed", ip, createdAt: { gte: new Date(Date.now() - BRUTE_FORCE_WINDOW_MS) } },
    });
    // Só no momento exato em que cruza o teto — não manda um e-mail por
    // tentativa depois disso, só uma vez por janela de 15min.
    if (count === BRUTE_FORCE_ALERT_THRESHOLD) {
      await sendBruteForceAlert({ ip, failedCount: count, windowMinutes: BRUTE_FORCE_WINDOW_MS / 60_000 });
    }
  }
}

// Nunca lança — um log de auditoria que derruba a ação que está registrando
// seria pior que não logar. Falha em silêncio (fica só no log do runtime).
export async function logSecurityEvent(input: LogInput): Promise<void> {
  try {
    const ip = await getClientIp();
    await prismaAdmin.securityEvent.create({
      data: {
        type: input.type,
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        organizationId: input.organizationId ?? null,
        targetId: input.targetId ?? null,
        ip,
        metadata: input.metadata ?? undefined,
      },
    });
    await maybeSendAlert(input, ip).catch((err) => console.error("[security-alert] falha ao enviar alerta", input.type, err));
  } catch (err) {
    console.error("[security-event] falha ao gravar log de auditoria", input.type, err);
  }
}
