import Link from "next/link";
import { requestPasswordReset, verifyPasswordResetCode } from "@/lib/actions/auth";
import { FormField } from "@/components/FormField";
import { ArrowLeft } from "lucide-react";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; email?: string; codeError?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[380px] px-6">
        <div className="flex items-center justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-preto.svg" alt="Spinos" style={{ height: "36px", width: "auto" }} />
        </div>

        <h1
          className="text-[22px] font-medium m-0 mb-2 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
        >
          Esqueci minha senha
        </h1>

        {params.sent ? (
          <>
            <p className="text-[13px] text-center mb-6" style={{ color: "var(--fg-muted)" }}>
              Se {params.email ? <strong>{params.email}</strong> : "esse e-mail"} tiver uma conta, mandamos um código
              de 6 dígitos pra ele. Confira sua caixa de entrada (e o spam) e digite abaixo.
            </p>

            {params.codeError && (
              <div
                className="mb-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
                style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
              >
                {params.codeError}
              </div>
            )}

            <form action={verifyPasswordResetCode} className="flex flex-col gap-4">
              <input type="hidden" name="email" value={params.email ?? ""} />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
                  Código de 6 dígitos
                </span>
                <input
                  name="code"
                  placeholder="000000"
                  required
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="rounded-[10px] border px-3.5 text-[18px] text-center outline-none"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    color: "var(--fg)",
                    height: "44px",
                    letterSpacing: "0.3em",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </label>
              <button
                type="submit"
                className="mt-2 text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
                style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
              >
                Confirmar código
              </button>
            </form>

            <form action={requestPasswordReset} className="mt-3">
              <input type="hidden" name="email" value={params.email ?? ""} />
              <button
                type="submit"
                className="w-full text-[12.5px] font-medium border-0 bg-transparent cursor-pointer"
                style={{ color: "var(--fg-muted)" }}
              >
                Não chegou? Reenviar código
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-[13px] text-center mb-6" style={{ color: "var(--fg-muted)" }}>
              Digite seu e-mail e mandamos um código de 6 dígitos pra você criar uma senha nova.
            </p>

            {params.error && (
              <div
                className="mb-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
                style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
              >
                {params.error}
              </div>
            )}

            <form action={requestPasswordReset} className="flex flex-col gap-4">
              <FormField label="E-mail" name="email" placeholder="voce@empresa.com.br" required />
              <button
                type="submit"
                className="mt-2 text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
                style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
              >
                Enviar código
              </button>
            </form>
          </>
        )}

        <p className="text-[12.5px] text-center mt-6" style={{ color: "var(--fg-muted)" }}>
          <Link href="/login" className="inline-flex items-center gap-1" style={{ color: "var(--primary)" }}>
            <ArrowLeft size={12} strokeWidth={2} />
            Voltar pro login
          </Link>
        </p>
      </div>
    </div>
  );
}
