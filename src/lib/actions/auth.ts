"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-org";
import { SITE_URL } from "@/lib/site-url";

// Mantém public.users.email sincronizado com auth.users.email — importante
// depois de uma troca de e-mail confirmada, senão o app mostra o e-mail antigo.
async function syncUserEmail(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getUser();
  if (data.user?.id && data.user.email) {
    await prisma.user.update({
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
    redirect(`/auth/auth-code-error?reason=${encodeURIComponent(error.message)}`);
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      await syncUserEmail(supabase);
      redirect(next);
    }
    redirect(`/auth/auth-code-error?reason=${encodeURIComponent(error.message)}`);
  }

  redirect("/auth/auth-code-error?reason=Link sem código de confirmação.");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/signup?error=Preencha e-mail e senha.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${SITE_URL}/auth/confirm?next=/onboarding` },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    // Por segurança contra enumeração de e-mails, o Supabase retorna um
    // "sucesso" com um ID que não corresponde a nenhuma conta real quando o
    // e-mail já tem cadastro confirmado. Se já existe um public.users com
    // esse e-mail sob outro ID, é exatamente esse caso — não criar nada.
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== data.user.id) {
      redirect(`/signup?error=${encodeURIComponent("Esse e-mail já tem uma conta. Faça login ou clique em \"Esqueci minha senha\".")}`);
    }

    // Cria o registro correspondente em public.users, usando o mesmo ID
    // do usuário no Supabase Auth — evita precisar de tabela de mapeamento.
    await prisma.user.upsert({
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const next = String(formData.get("next") ?? "").trim();
  if (next.startsWith("/")) {
    redirect(next);
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: data.user.id },
    orderBy: { createdAt: "asc" },
  });

  redirect(membership ? "/" : "/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/login/esqueci-senha?error=Informe seu e-mail.");
  }

  const supabase = await createClient();
  // Sempre redireciona pra "enviamos o link" mesmo se o e-mail não existir —
  // isso evita que alguém descubra quais e-mails têm conta só testando aqui.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/redefinir-senha`,
  });

  redirect("/login/esqueci-senha?sent=1");
}

export async function requestEmailChange(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const newEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!newEmail) {
    redirect("/settings/empresa?emailError=Informe o novo e-mail.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent("/settings/empresa?emailAtualizado=1")}` },
  );

  if (error) {
    redirect(`/settings/empresa?emailError=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings/empresa?emailPendente=1");
}

export async function updatePassword(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect("/redefinir-senha?error=A senha precisa ter pelo menos 8 caracteres.");
  }
  if (password !== confirmPassword) {
    redirect("/redefinir-senha?error=As senhas não são iguais.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/redefinir-senha?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/?senhaAtualizada=1");
}
