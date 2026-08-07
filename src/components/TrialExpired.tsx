import { PLANS } from "@/lib/plans";
import { createCheckoutSession } from "@/lib/actions/billing";

export function TrialExpired({ signOutAction }: { signOutAction: () => Promise<void> }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[520px] text-center">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-preto.svg" alt="Spinos" style={{ height: "30px", width: "auto" }} />
        </div>

        <h1 className="text-[22px] font-medium m-0 mb-3" style={{ fontFamily: "var(--font-display)" }}>
          Seu período de teste acabou
        </h1>
        <p className="text-[13.5px] leading-[1.6] mb-7" style={{ color: "var(--fg-muted)" }}>
          Os 7 dias grátis da sua empresa terminaram. Escolha um plano pra continuar usando o Spinos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-left">
          {Object.values(PLANS).map((plan) => (
            <div
              key={plan.id}
              className="rounded-[16px] border p-4 flex flex-col gap-3"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div>
                <div className="text-[13.5px] font-semibold">{plan.name}</div>
                <div className="mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                  <span className="text-[19px] font-bold" style={{ letterSpacing: "-0.02em" }}>
                    R${plan.priceMonthlyBRL}
                  </span>
                  <span className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
                    /mês
                  </span>
                </div>
              </div>
              <form action={createCheckoutSession.bind(null, plan.id)}>
                <button
                  type="submit"
                  className="w-full text-[12.5px] font-semibold px-3 py-2 rounded-[10px] border-0 cursor-pointer"
                  style={{ background: "var(--primary)", color: "#ffffff" }}
                >
                  Assinar
                </button>
              </form>
            </div>
          ))}
        </div>

        <a
          href="mailto:cyro@agenciaeverest.com.br?subject=Continuar%20usando%20o%20Spinos"
          className="inline-block text-[12.5px] no-underline mb-4"
          style={{ color: "var(--fg-faint)" }}
        >
          Prefere falar com a gente primeiro? Clique aqui.
        </a>

        <form action={signOutAction}>
          <button
            type="submit"
            className="block mx-auto text-[12.5px] cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--fg-faint)" }}
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
