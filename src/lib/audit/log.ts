import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prismaAdmin } from "@/lib/prisma-admin";
import { getClientIp } from "@/lib/auth/rate-limit";

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
  | "privacy.data_exported"
  | "privacy.deletion_requested"
  | "privacy.deletion_completed"
  | "privacy.third_party_data_redacted"
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
  } catch (err) {
    console.error("[security-event] falha ao gravar log de auditoria", input.type, err);
  }
}
