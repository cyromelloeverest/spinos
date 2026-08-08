import Link from "next/link";
import { redirect } from "next/navigation";
// prismaAdmin de propósito: página pública, sem sessão — o convite é achado
// pelo token, não existe organizationId conhecido antes disso.
import { prismaAdmin } from "@/lib/prisma-admin";
import { acceptInviteSignUp } from "@/lib/actions/team";

export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const invite = await prismaAdmin.invite.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    redirect("/convite/invalido");
  }

  const existingUser = await prismaAdmin.user.findUnique({ where: { email: invite.email } });
  const acceptAction = acceptInviteSignUp.bind(null, token);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[380px] px-6">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-preto.svg" alt="Spinos" style={{ height: "36px", width: "auto" }} />
          <div className="text-[11.5px] italic" style={{ fontFamily: "var(--font-display)", color: "var(--fg-faint)" }}>
            Inteligência Comercial
          </div>
        </div>

        <h1
          className="text-[22px] font-medium m-0 mb-2 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
        >
          Convite para {invite.organization.name}
        </h1>
        <p className="text-[13px] text-center mb-6" style={{ color: "var(--fg-muted)" }}>
          {invite.email}
        </p>

        {error && (
          <div
            className="mb-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
            style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
          >
            {error}
          </div>
        )}

        {existingUser ? (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-center m-0" style={{ color: "var(--fg-muted)" }}>
              Você já tem uma conta com esse e-mail. Faça login para entrar na equipe.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/aceitar-convite/${token}`)}`}
              className="text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border text-center no-underline"
              style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
            >
              Entrar e aceitar convite
            </Link>
          </div>
        ) : (
          <form action={acceptAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
                Crie uma senha
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                className="rounded-[10px] border px-3.5 h-[44px] text-[13.5px] outline-none"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
              />
            </label>
            <button
              type="submit"
              className="mt-2 text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
              style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
            >
              Aceitar convite
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
