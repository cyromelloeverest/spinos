"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Search, Loader2, X, Target } from "lucide-react";

const PROGRESS_MESSAGES = [
  "Vasculhando sinais públicos de compra…",
  "Cruzando os sinais com o seu ICP…",
  "Analisando o Opportunity Score de cada empresa…",
  "Priorizando quem está pronto pra comprar agora…",
  "Quase lá — organizando os melhores achados…",
];

export function SearchButton({
  disabled,
  disabledTitle,
  remainingSearches,
}: {
  disabled: boolean;
  disabledTitle?: string;
  remainingSearches?: number | null;
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const isDisabled = disabled || pending;
  const showModal = open || pending;

  useEffect(() => {
    if (!open || pending) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  return (
    <>
      <button
        type="button"
        disabled={isDisabled}
        title={disabled ? disabledTitle : undefined}
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center gap-2.5 text-[14px] font-semibold rounded-full pl-5 pr-6 py-3.5 border-0 whitespace-nowrap transition-transform w-full sm:w-auto ${!isDisabled ? "animate-glow-pulse" : ""}`}
        style={{
          background: isDisabled ? "var(--card-hover)" : "var(--primary)",
          color: isDisabled ? "var(--fg-faint)" : "#ffffff",
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {pending ? <Loader2 size={18} strokeWidth={2} className="animate-spin" /> : <Search size={18} strokeWidth={2.25} />}
        {pending ? "Buscando…" : disabled ? (disabledTitle ?? "Indisponível") : "Buscar oportunidades"}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.55)" }}
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-[16px] border p-6"
            style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {pending ? (
              <SearchingPhase />
            ) : (
              <ConfirmPhase remainingSearches={remainingSearches} onCancel={() => setOpen(false)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmPhase({
  remainingSearches,
  onCancel,
}: {
  remainingSearches?: number | null;
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          <Target size={20} strokeWidth={1.75} />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center w-7 h-7 rounded-[6px] border-0"
          style={{ background: "transparent", color: "var(--fg-faint)", cursor: "pointer" }}
          aria-label="Fechar"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>

      <h2 className="text-[17px] font-semibold m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Vamos encontrar suas próximas oportunidades
      </h2>
      <p className="text-[13.5px] leading-[1.6] mb-1" style={{ color: "var(--fg-muted)" }}>
        Vamos vasculhar sinais públicos reais — notícias, vagas, editais, expansões — pra achar empresas com alta
        chance de fechar negócio com você agora.
      </p>
      {typeof remainingSearches === "number" ? (
        <p className="text-[12.5px] mb-5" style={{ color: "var(--fg-faint)" }}>
          Isso usa 1 das suas buscas do mês ({remainingSearches} restante{remainingSearches === 1 ? "" : "s"} depois
          desta).
        </p>
      ) : (
        <div className="mb-5" />
      )}

      <div className="flex items-center gap-2.5">
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-2 text-[13.5px] font-semibold rounded-[12px] px-4 py-3 border-0"
          style={{ background: "var(--primary)", color: "#ffffff", cursor: "pointer" }}
        >
          <Search size={16} strokeWidth={2.25} />
          Buscar agora
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[13.5px] font-medium rounded-[12px] px-4 py-3 border"
          style={{ background: "transparent", color: "var(--fg-muted)", borderColor: "var(--border)", cursor: "pointer" }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}

function SearchingPhase() {
  const [started, setStarted] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1));
    }, 4200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center py-2">
      <div
        className="w-11 h-11 rounded-[12px] flex items-center justify-center mx-auto mb-4"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        <Loader2 size={20} strokeWidth={2} className="animate-spin" />
      </div>
      <h2 className="text-[16px] font-semibold m-0 mb-1.5">Procurando suas oportunidades</h2>
      <p className="text-[13px] mb-5 min-h-[20px]" style={{ color: "var(--fg-muted)" }}>
        {PROGRESS_MESSAGES[messageIndex]}
      </p>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full"
          style={{
            background: "var(--primary)",
            width: started ? "94%" : "4%",
            transition: "width 58s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
      <p className="text-[11.5px] mt-3" style={{ color: "var(--fg-faint)" }}>
        Isso leva até 1 minuto — não feche esta página.
      </p>
    </div>
  );
}
