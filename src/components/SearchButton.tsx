"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Search, Loader2, X, Target, AlertTriangle } from "lucide-react";

const PROGRESS_MESSAGES = [
  "Vasculhando sinais públicos de compra…",
  "Cruzando os sinais com o seu ICP…",
  "Calculando o Spinos Score de cada empresa…",
  "Priorizando quem está pronto pra comprar agora…",
  "Quase lá — organizando os melhores achados…",
];

export function SearchButton({
  disabled,
  disabledTitle,
  remainingSearches,
  isTrialing,
  icpTooGeneric,
}: {
  disabled: boolean;
  disabledTitle?: string;
  remainingSearches?: number | null;
  isTrialing?: boolean;
  icpTooGeneric?: boolean;
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  // Fechar o modal (X, backdrop, Esc) nunca cancela a submissão em si — o
  // form/server action continua rodando no servidor independente do que a
  // UI mostra. "dismissed" só controla visibilidade, não a request.
  const [dismissed, setDismissed] = useState(false);
  const isDisabled = disabled || pending;
  const showModal = (open || pending) && !dismissed;

  function openModal() {
    setDismissed(false);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setDismissed(true);
  }

  useEffect(() => {
    if (!showModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  return (
    <>
      <button
        type="button"
        disabled={isDisabled}
        title={disabled ? disabledTitle : undefined}
        onClick={openModal}
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
          onClick={closeModal}
        >
          <div
            className="w-full max-w-[440px] rounded-[16px] border p-6"
            style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {pending ? (
              <SearchingPhase onDismiss={closeModal} />
            ) : (
              <ConfirmPhase
                remainingSearches={remainingSearches}
                isTrialing={isTrialing}
                icpTooGeneric={icpTooGeneric}
                onCancel={closeModal}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmPhase({
  remainingSearches,
  isTrialing,
  icpTooGeneric,
  onCancel,
}: {
  remainingSearches?: number | null;
  isTrialing?: boolean;
  icpTooGeneric?: boolean;
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
          className="flex items-center justify-center w-7 h-7 rounded-[8px] border-0"
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
        Vamos vasculhar sinais públicos reais (notícias, vagas, editais, expansões) pra achar empresas com alta
        chance de fechar negócio com você agora.
      </p>
      {typeof remainingSearches === "number" ? (
        <p className="text-[12.5px] mb-5" style={{ color: "var(--fg-faint)" }}>
          Isso usa 1 das suas buscas {isTrialing ? "do teste grátis" : "do mês"} ({remainingSearches} restante
          {remainingSearches === 1 ? "" : "s"} depois desta).
        </p>
      ) : (
        <div className="mb-5" />
      )}

      {icpTooGeneric && (
        <div
          className="flex gap-2.5 rounded-[10px] border px-3.5 py-3 mb-5 text-left"
          style={{ borderColor: "var(--warn)", background: "var(--card-hover)" }}
        >
          <AlertTriangle size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
          <p className="text-[12.5px] leading-[1.55] m-0" style={{ color: "var(--fg-muted)" }}>
            Seu ICP está bem amplo hoje (poucos detalhes preenchidos), o que tende a trazer oportunidades fracas —
            e o teste grátis tem poucas buscas disponíveis.{" "}
            <a href="/settings/icp" className="font-semibold" style={{ color: "var(--warn)" }}>
              Refinar ICP antes de buscar
            </a>
            .
          </p>
        </div>
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

const SLOW_WARNING_MS = 75_000;

function SearchingPhase({ onDismiss }: { onDismiss: () => void }) {
  const [started, setStarted] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [slow, setSlow] = useState(false);

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

  useEffect(() => {
    const timeout = setTimeout(() => setSlow(true), SLOW_WARNING_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="text-center py-2">
      <div className="flex justify-end -mt-2 -mr-2 mb-1">
        <button
          type="button"
          onClick={onDismiss}
          className="flex items-center justify-center w-7 h-7 rounded-[8px] border-0"
          style={{ background: "transparent", color: "var(--fg-faint)", cursor: "pointer" }}
          aria-label="Fechar"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
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
      {slow ? (
        <div className="mt-4 rounded-[10px] border px-3.5 py-3 text-left" style={{ background: "var(--card-hover)", borderColor: "var(--border)" }}>
          <p className="text-[12.5px] leading-[1.55] m-0 mb-2.5" style={{ color: "var(--fg-muted)" }}>
            Isso está demorando mais que o esperado, mas a busca continua rodando do nosso lado. Pode fechar esta
            janela ou a página sem problema — as oportunidades aparecem na lista assim que terminar.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-[12.5px] font-semibold rounded-[10px] px-3.5 py-2 border-0"
            style={{ background: "var(--primary)", color: "#ffffff", cursor: "pointer" }}
          >
            Atualizar página agora
          </button>
        </div>
      ) : (
        <p className="text-[11.5px] mt-3" style={{ color: "var(--fg-faint)" }}>
          Isso leva até 1 minuto. Pode fechar esta página — a busca continua no nosso lado e as oportunidades
          aparecem na lista quando terminar.
        </p>
      )}
    </div>
  );
}
