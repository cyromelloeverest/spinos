"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
// prismaAdmin (não a conexão restrita): auth roda antes de existir contexto
// de org — signup cria o User antes de qualquer Membership, e login precisa
// achar a Membership pra decidir pra onde redirecionar. Mesma categoria de
// exceção do current-org.ts.
import { prismaAdmin } from "@/lib/prisma-admin";
import { getCurrentUserId } from "@/lib/auth/current-org";
import { translateAuthError } from "@/lib/auth/error-messages";
import { isRateLimited, recordAttempt } from "@/lib/auth/rate-limit";
import { logSecurityEvent } from "@/lib/audit/log";
import { emailSchema, passwordSchema, firstIssueMessage } from "@/lib/validation";
import { SITE_URL } from "@/lib/site-url";
import { logError } from "@/lib/log-error";

// Mantém public.users.email sincronizado com auth.users.email — importante
// depois de uma troca de e-mail confirmada, senão o app mostra o e-mail antigo.
async function syncUserEmail(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getUser();
  if (data.user?.id && data.user.email) {
    await prismaAdmin.user.update({
      where: { id: data.user.id },
      data: { email: data.user.email },
    }).catch(() => {});
  }
}

// Exige um clique real (form POST) em vez de confirmar direto no GET —
// antivírus de e-mail "pré-visitam" links automaticamente, e um link que
// confirma sozinho ao ser aberto é consumido por eles antes da pessoa clicar.
export async function confirmAuthLink(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const token_hash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  const next = String(formData.get("next") ?? "/");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await syncUserEmail(supabase);
      redirect(next);
    }
    logError("auth: exchangeCodeForSession falhou", error.message, { type });
    redirect(`/auth/auth-code-error?reason=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      await syncUserEmail(supabase);
      redirect(next);
    }
    logError("auth: verifyOtp falhou", error.message, { type });
    redirect(`/auth/auth-code-error?reason=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  redirect("/auth/auth-code-error?reason=Link sem código de confirmação.");
}

export async function signUp(formData: FormData) {
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const acceptedTerms = formData.get("acceptTerms") === "on";

  const emailResult = emailSchema.safeParse(rawEmail);
  const passwordResult = passwordSchema.safeParse(password);
  if (!emailResult.success) {
    redirect(`/signup?error=${encodeURIComponent(firstIssueMessage(emailResult.error))}`);
  }
  if (!passwordResult.success) {
    redirect(`/signup?error=${encodeURIComponent(firstIssueMessage(passwordResult.error))}`);
  }
  if (!acceptedTerms) {
    redirect(`/signup?error=${encodeURIComponent("Você precisa aceitar os Termos de Uso e a Política de Privacidade.")}`);
  }
  const email = emailResult.data;

  if (await isRateLimited("signup")) {
    redirect("/signup?error=Muitas tentativas de cadastro. Aguarde um pouco e tente de novo.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${SITE_URL}/auth/confirm?next=/onboarding` },
  });

  if (error) {
    await recordAttempt("signup");
    redirect(`/signup?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  await logSecurityEvent({ type: "auth.signup", actorUserId: data.user?.id, actorEmail: email });

  if (data.user) {
    // Por segurança contra enumeração de e-mails, o Supabase retorna um
    // "sucesso" com um ID que não corresponde a nenhuma conta real quando o
    // e-mail já tem cadastro confirmado. Se já existe um public.users com
    // esse e-mail sob outro ID, é exatamente esse caso — não criar nada.
    const existing = await prismaAdmin.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== data.user.id) {
      redirect(`/signup?error=${encodeURIComponent("Esse e-mail já tem uma conta. Faça login ou clique em \"Esqueci minha senha\".")}`);
    }

    // Cria o registro correspondente em public.users, usando o mesmo ID
    // do usuário no Supabase Auth — evita precisar de tabela de mapeamento.
    await prismaAdmin.user.upsert({
      where: { id: data.user.id },
      update: {},
      create: { id: data.user.id, email },
    });
  }

  if (!data.session) {
    redirect("/signup/verifique-seu-email");
  }

  redirect("/onboarding");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (await isRateLimited("signin")) {
    redirect("/login?error=Muitas tentativas de login. Aguarde alguns minutos e tente de novo.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordAttempt("signin");
    await logSecurityEvent({ type: "auth.signin_failed", actorEmail: email });
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  await logSecurityEvent({ type: "auth.signin_success", actorUserId: data.user.id, actorEmail: email });

  const next = String(formData.get("next") ?? "").trim();
  if (next.startsWith("/")) {
    redirect(next);
  }

  const membership = await prismaAdmin.membership.findFirst({
    where: { userId: data.user.id },
    orderBy: { createdAt: "asc" },
  });

  redirect(membership ? "/" : "/onboarding");
}

export async function signOut() {
  const userId = await getCurrentUserId();
  const supabase = await createClient();
  await supabase.auth.signOut();
  await logSecurityEvent({ type: "auth.signout", actorUserId: userId });
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/login/esqueci-senha?error=Informe seu e-mail.");
  }

  // Verifica o limite mas não grava tentativa aqui embaixo condicionada ao
  // resultado do Supabase — sempre grava, sucesso ou não, porque o endpoint
  // não deve revelar (por diferença de comportamento) quais e-mails existem.
  if (await isRateLimited("password-reset")) {
    redirect("/login/esqueci-senha?sent=1");
  }

  // Só valida formato (não bloqueia por "e-mail não existe", pelo mesmo
  // motivo do comentário acima) — evita gastar uma tentativa do Supabase com
  // lixo obviamente malformado.
  if (emailSchema.safeParse(email).success) {
    const supabase = await createClient();
    // Sempre redireciona pra "enviamos o link" mesmo se o e-mail não existir —
    // isso evita que alguém descubra quais e-mails têm conta só testando aqui.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/auth/confirm?next=/redefinir-senha`,
    });
    await logSecurityEvent({ type: "auth.password_reset_requested", actorEmail: email });
  }
  await recordAttempt("password-reset");

  redirect("/login/esqueci-senha?sent=1");
}

export async function requestEmailChange(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const emailResult = emailSchema.safeParse(rawEmail);
  if (!emailResult.success) {
    redirect(`/settings/empresa?emailError=${encodeURIComponent(firstIssueMessage(emailResult.error))}`);
  }
  const newEmail = emailResult.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent("/settings/empresa?emailAtualizado=1")}` },
  );

  if (error) {
    redirect(`/settings/empresa?emailError=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  redirect("/settings/empresa?emailPendente=1");
}

export async function updatePassword(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    redirect(`/redefinir-senha?error=${encodeURIComponent(firstIssueMessage(passwordResult.error))}`);
  }
  if (password !== confirmPassword) {
    redirect("/redefinir-senha?error=As senhas não são iguais.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/redefinir-senha?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  await logSecurityEvent({ type: "auth.password_updated", actorUserId: userId });

  redirect("/?senhaAtualizada=1");
}
