import Link from "next/link";
import { signIn } from "@/lib/actions/auth";
import { FormField } from "@/components/FormField";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[380px] px-6">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-preto.svg" alt="Spinos" style={{ height: "26px", width: "auto" }} />
          <div className="text-[11.5px] italic" style={{ fontFamily: "var(--font-display)", color: "var(--fg-faint)" }}>
            Inteligência Comercial
          </div>
        </div>

        <h1
          className="text-[22px] font-medium m-0 mb-6 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
        >
          Entrar
        </h1>

        {params.error && (
          <div
            className="mb-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
            style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
          >
            {params.error}
          </div>
        )}

        <form action={signIn} className="flex flex-col gap-4">
          <FormField label="E-mail" name="email" placeholder="voce@empresa.com.br" required />
          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
                Senha
              </span>
              <Link href="/login/esqueci-senha" className="text-[11.5px]" style={{ color: "var(--primary)" }}>
                Esqueci minha senha
              </Link>
            </div>
            <input
              type="password"
              name="password"
              required
              className="rounded-[10px] border px-3.5 h-[44px] text-[13.5px] outline-none"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>

          <button
            type="submit"
            className="mt-2 text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
          >
            Entrar
          </button>
        </form>

        <p className="text-[12.5px] text-center mt-6" style={{ color: "var(--fg-muted)" }}>
          Ainda não tem conta?{" "}
          <Link href="/signup" style={{ color: "var(--primary)" }}>
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
