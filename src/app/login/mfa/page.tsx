import { verifyMfaChallenge } from "@/lib/actions/mfa";

export default async function LoginMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

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
          Verificação em duas etapas
        </h1>
        <p className="text-[13px] text-center mb-6" style={{ color: "var(--fg-muted)" }}>
          Digite o código de 6 dígitos do seu app autenticador.
        </p>

        {params.error && (
          <div
            className="mb-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
            style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
          >
            {params.error}
          </div>
        )}

        <form action={verifyMfaChallenge} className="flex flex-col gap-4">
          {params.next && <input type="hidden" name="next" value={params.next} />}
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
              Código <span style={{ color: "var(--primary)" }}>*</span>
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
            Confirmar
          </button>
        </form>
      </div>
    </div>
  );
}
