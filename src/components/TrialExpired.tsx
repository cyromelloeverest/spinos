export function TrialExpired({ signOutAction }: { signOutAction: () => Promise<void> }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[420px] px-6 text-center">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-preto.svg" alt="Spinos" style={{ height: "26px", width: "auto" }} />
        </div>

        <h1 className="text-[22px] font-medium m-0 mb-3" style={{ fontFamily: "var(--font-display)" }}>
          Seu período de teste acabou
        </h1>
        <p className="text-[13.5px] leading-[1.6] mb-6" style={{ color: "var(--fg-muted)" }}>
          Os 7 dias grátis da sua empresa terminaram. Fale com a gente pra continuar usando o Spinos.
        </p>

        <a
          href="mailto:cyro@agenciaeverest.com.br?subject=Continuar%20usando%20o%20Spinos"
          className="inline-block text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border no-underline mb-4"
          style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
        >
          Falar com a gente
        </a>

        <form action={signOutAction}>
          <button
            type="submit"
            className="text-[12.5px] cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--fg-faint)" }}
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
