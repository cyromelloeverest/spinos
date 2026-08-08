"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth/current-org";
import { translateAuthError } from "@/lib/auth/error-messages";
import { isRateLimited, recordAttempt } from "@/lib/auth/rate-limit";
import { logSecurityEvent } from "@/lib/audit/log";

export type EnrollResult =
  | { status: "ok"; factorId: string; qrCode: string; secret: string }
  | { status: "error"; message: string };

// Antes de gerar um fator novo, limpa qualquer fator TOTP que ficou "meio
// cadastrado" (o usuário abriu a tela, saiu sem terminar) — o Supabase não
// deixa ter dois fatores TOTP pendentes do mesmo tipo, e um fator não
// verificado não serve pra nada além de atrapalhar uma nova tentativa.
async function cleanupUnverifiedTotpFactors(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  // listFactors() só devolve fatores VERIFICADOS em data.totp — os "meio
  // cadastrados" só aparecem em data.all, por isso filtra ali.
  const { data } = await supabase.auth.mfa.listFactors();
  const unverified = data?.all?.filter((f) => f.factor_type === "totp" && f.status === "unverified") ?? [];
  for (const factor of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {});
  }
}

export async function startMfaEnrollment(): Promise<EnrollResult> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  await cleanupUnverifiedTotpFactors(supabase);

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Spinos ${new Date().toISOString().slice(0, 10)}`,
  });

  if (error || !data) {
    return { status: "error", message: translateAuthError(error?.message ?? "") };
  }

  return { status: "ok", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export type ConfirmResult = { status: "ok" } | { status: "error"; message: string };

export async function confirmMfaEnrollment(factorId: string, code: string): Promise<ConfirmResult> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    return { status: "error", message: translateAuthError(challengeError?.message ?? "") };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });

  if (verifyError) {
    return { status: "error", message: "Código inválido. Confira o app autenticador e tente de novo." };
  }

  await logSecurityEvent({ type: "auth.mfa_enrolled", actorUserId: userId });
  return { status: "ok" };
}

export async function unenrollMfaFactor(factorId: string): Promise<ConfirmResult> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { status: "error", message: translateAuthError(error.message) };
  }

  await logSecurityEvent({ type: "auth.mfa_disabled", actorUserId: userId });
  return { status: "ok" };
}

export type FactorSummary = { id: string; createdAt: string };

export async function listVerifiedMfaFactors(): Promise<FactorSummary[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  // .totp já só traz fatores verificados (ver comentário em cleanupUnverifiedTotpFactors).
  return (data?.totp ?? []).map((f) => ({ id: f.id, createdAt: f.created_at }));
}

// Chamado na tela de desafio pós-senha (/login/mfa) — completa o segundo
// fator e eleva a sessão de aal1 pra aal2. Rate limitado por IP, não por
// usuário: nesse ponto a senha já foi validada, então o identificador mais
// útil pra conter força bruta continua sendo o IP de origem.
export async function verifyMfaChallenge(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();

  if (await isRateLimited("mfa-challenge")) {
    redirect("/login/mfa?error=Muitas tentativas. Aguarde alguns minutos e tente de novo.");
  }

  const supabase = await createClient();
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const factor = factorsData?.totp?.[0];
  if (!factor) {
    // Sem fator verificado — não deveria nem ter chegado nessa tela.
    redirect("/");
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError || !challenge) {
    await recordAttempt("mfa-challenge");
    redirect(`/login/mfa?error=${encodeURIComponent(translateAuthError(challengeError?.message ?? ""))}`);
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });

  const userId = await getCurrentUserId();
  if (verifyError) {
    await recordAttempt("mfa-challenge");
    await logSecurityEvent({ type: "auth.mfa_challenge_failed", actorUserId: userId });
    redirect(`/login/mfa?error=${encodeURIComponent("Código inválido. Tente de novo.")}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  await logSecurityEvent({ type: "auth.mfa_challenge_succeeded", actorUserId: userId });
  redirect(next.startsWith("/") ? next : "/");
}
