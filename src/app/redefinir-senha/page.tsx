import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/current-org";
import { updatePassword } from "@/lib/actions/auth";
import { FormField } from "@/components/FormField";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

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
            Spinos
          </div>
        </div>

        <h1
          className="text-[22px] font-medium m-0 mb-6 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
        >
          Criar nova senha
        </h1>

        {params.error && (
          <div
            className="mb-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
            style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
          >
            {params.error}
          </div>
        )}

        <form action={updatePassword} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
              Nova senha
            </span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="rounded-[8px] border px-3 py-2.5 text-[13.5px] outline-none"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
              Confirmar nova senha
            </span>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              className="rounded-[8px] border px-3 py-2.5 text-[13.5px] outline-none"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>

          <button
            type="submit"
            className="mt-2 text-[13px] font-semibold px-5 py-2.5 rounded-lg border cursor-pointer"
            style={{ background: "var(--copper)", borderColor: "var(--copper)", color: "#1a0f06" }}
          >
            Salvar nova senha
          </button>
        </form>
      </div>
    </div>
  );
}
