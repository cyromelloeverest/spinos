import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { FormField } from "@/components/FormField";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[380px] px-6">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div
            className="w-[18px] h-[18px] rounded-[4px] flex-shrink-0"
            style={{ background: "linear-gradient(155deg, var(--copper), #a85a2a)" }}
          />
          <div className="text-[16px]" style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}>
            Opportunity OS
          </div>
        </div>

        <h1
          className="text-[22px] font-medium m-0 mb-6 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
        >
          Criar conta
        </h1>

        {params.error && (
          <div
            className="mb-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
            style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
          >
            {params.error}
          </div>
        )}

        <form action={signUp} className="flex flex-col gap-4">
          <FormField label="E-mail" name="email" placeholder="voce@empresa.com.br" required />
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
              Senha
            </span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="rounded-[8px] border px-3 py-2.5 text-[13.5px] outline-none"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>

          <button
            type="submit"
            className="mt-2 text-[13px] font-semibold px-5 py-2.5 rounded-lg border cursor-pointer"
            style={{ background: "var(--copper)", borderColor: "var(--copper)", color: "#1a0f06" }}
          >
            Criar conta
          </button>
        </form>

        <p className="text-[12.5px] text-center mt-6" style={{ color: "var(--fg-muted)" }}>
          Já tem conta?{" "}
          <Link href="/login" style={{ color: "var(--copper)" }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
