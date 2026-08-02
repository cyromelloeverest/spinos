"use client";

import { useFormStatus } from "react-dom";

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
      className="text-[12.5px] font-semibold rounded-full border px-4 py-2 whitespace-nowrap"
      style={{
        fontFamily: "var(--font-mono)",
        background: isDisabled ? "var(--card)" : "var(--primary)",
        color: isDisabled ? "var(--fg-faint)" : "#ffffff",
        borderColor: isDisabled ? "var(--border)" : "var(--primary)",
        cursor: isDisabled ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Buscando… (leva até 1 min)" : disabled ? (disabledTitle ?? "Indisponível") : "Buscar oportunidades"}
    </button>
  );
}
