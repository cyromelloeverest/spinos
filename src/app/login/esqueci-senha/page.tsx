import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { FormField } from "@/components/FormField";
import { ArrowLeft } from "lucide-react";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[380px] px-6">
        <div className="flex items-center justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-preto.svg" alt="Spinos" style={{ height: "30px", width: "auto" }} />
        </div>

        <h1
          className="text-[22px] font-medium m-0 mb-2 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
        >
          Esqueci minha senha
        </h1>
        <p className="text-[13px] text-center mb-6" style={{ color: "var(--fg-muted)" }}>
          Digite seu e-mail e mandamos um link pra você criar uma senha nova.
        </p>

        {params.error && (
          <div
            className="mb-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
            style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
          >
            {params.error}
          </div>
        )}

        {params.sent ? (
          <div
            className="rounded-[8px] border px-4 py-3 text-[12.5px] leading-[1.6]"
            style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
          >
            Se esse e-mail tiver uma conta, mandamos um link de redefinição pra ele. Confira sua caixa de entrada (e o spam).
          </div>
        ) : (
          <form action={requestPasswordReset} className="flex flex-col gap-4">
            <FormField label="E-mail" name="email" placeholder="voce@empresa.com.br" required />
            <button
              type="submit"
              className="mt-2 text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
              style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
            >
              Enviar link
            </button>
          </form>
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
