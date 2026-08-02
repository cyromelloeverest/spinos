"use client";

import { useFormStatus } from "react-dom";
import { Search, Loader2 } from "lucide-react";

export function SearchButton({
  disabled,
  disabledTitle,
}: {
  disabled: boolean;
  disabledTitle?: string;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      title={disabled ? disabledTitle : undefined}
      className="flex items-center gap-2.5 text-[14px] font-semibold rounded-full pl-5 pr-6 py-3.5 border-0 whitespace-nowrap transition-transform"
      style={{
        background: isDisabled ? "var(--card-hover)" : "var(--primary)",
        color: isDisabled ? "var(--fg-faint)" : "#ffffff",
        cursor: isDisabled ? "not-allowed" : "pointer",
        boxShadow: isDisabled ? "none" : "0 8px 20px rgba(37,99,235,0.35)",
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {pending ? <Loader2 size={18} strokeWidth={2} className="animate-spin" /> : <Search size={18} strokeWidth={2.25} />}
      {pending ? "Buscando… (leva até 1 min)" : disabled ? (disabledTitle ?? "Indisponível") : "Buscar oportunidades"}
    </button>
  );
}
