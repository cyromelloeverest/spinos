import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";

  // Com o template de e-mail padrão do Supabase, o link do usuário passa
  // pelo endpoint de verificação hospedado por eles e volta pra cá com um
  // "code" (fluxo PKCE) — não com token_hash. Só chegaria token_hash/type
  // aqui se o template de e-mail fosse customizado para usar
  // {{ .TokenHash }} diretamente em vez de {{ .ConfirmationURL }}.
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const authError = searchParams.get("error_description");

  if (authError) {
    redirect(`/auth/auth-code-error?reason=${encodeURIComponent(authError)}`);
  }

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
