"use client";

import { useFormStatus } from "react-dom";
import { Crosshair, Building2, MapPin, Search, Loader2 } from "lucide-react";

// Painel de busca dirigida — o cliente já tem uma empresa em mente (um
// lead que já está trabalhando fora do Spinos) e quer o Spinos Score
// completo dela, sem passar pela descoberta aberta. Mesmo motor de busca
// (searchSpecificCompany em search.ts), mesma cota/cooldown/crédito.
export function TargetedSearchForm({
  disabled,
  disabledTitle,
}: {
  disabled: boolean;
  disabledTitle?: string;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <div
      className="rounded-[16px] border p-5"
      style={{ borderColor: "var(--border)", background: "var(--card)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          <Crosshair size={17} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">Já tem uma empresa em mente?</div>
          <div className="text-[12px] leading-[1.4]" style={{ color: "var(--fg-muted)" }}>
            Busca dirigida — pesquisamos só sobre ela e te damos o Spinos Score completo.
          </div>
        </div>
      </div>

      <div
        className={`flex flex-col sm:flex-row rounded-[12px] border border-[var(--border)] overflow-hidden transition-shadow duration-150 ${
          isDisabled ? "opacity-60" : "focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15"
        }`}
        style={{ background: "var(--bg)" }}
      >
        <div className="flex items-center gap-2 flex-[1.4] min-w-0 px-3.5 py-3 sm:border-r sm:border-r-[var(--border)]">
          <Building2 size={15} strokeWidth={1.75} style={{ color: "var(--fg-faint)" }} className="flex-shrink-0" />
          <input
            name="companyName"
            placeholder="Nome da empresa"
            required
            disabled={isDisabled}
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13.5px]"
            style={{ color: "var(--fg)" }}
          />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 px-3.5 py-3">
          <MapPin size={15} strokeWidth={1.75} style={{ color: "var(--fg-faint)" }} className="flex-shrink-0" />
          <input
            name="location"
            placeholder="Cidade, UF (opcional)"
            disabled={isDisabled}
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13.5px]"
            style={{ color: "var(--fg)" }}
          />
        </div>
        <button
          type="submit"
          disabled={isDisabled}
          title={disabled && !pending ? disabledTitle : undefined}
          className="flex items-center justify-center gap-2 text-[13px] font-semibold px-5 py-3 border-0 flex-shrink-0 transition-colors whitespace-nowrap"
          style={{
            background: isDisabled ? "var(--card-hover)" : "var(--primary)",
            color: isDisabled ? "var(--fg-faint)" : "#ffffff",
            cursor: isDisabled ? "not-allowed" : "pointer",
          }}
        >
          {pending ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <Search size={15} strokeWidth={2.25} />}
          {pending ? "Pesquisando…" : "Buscar essa empresa"}
        </button>
      </div>

      {disabled && !pending && disabledTitle && (
        <p className="text-[11.5px] mt-2" style={{ color: "var(--fg-faint)" }}>
          {disabledTitle}
        </p>
      )}
    </div>
  );
}
