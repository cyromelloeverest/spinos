import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/auth/rate-limit";

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
  | "team.member_invited"
  | "team.member_removed"
  | "team.invite_canceled"
  | "team.invite_accepted";

type LogInput = {
  type: SecurityEventType;
  actorUserId?: string | null;
  actorEmail?: string | null;
  organizationId?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

// Nunca lança — um log de auditoria que derruba a ação que está registrando
// seria pior que não logar. Falha em silêncio (fica só no log do runtime).
export async function logSecurityEvent(input: LogInput): Promise<void> {
  try {
    const ip = await getClientIp();
    await prisma.securityEvent.create({
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
  } catch (err) {
    console.error("[security-event] falha ao gravar log de auditoria", input.type, err);
  }
}
