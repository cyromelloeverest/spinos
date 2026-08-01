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
        background: isDisabled ? "var(--card)" : "var(--copper)",
        color: isDisabled ? "var(--fg-faint)" : "#1a0f06",
        borderColor: isDisabled ? "var(--border)" : "var(--copper)",
        cursor: isDisabled ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Buscando… (leva até 1 min)" : disabled ? (disabledTitle ?? "Indisponível") : "Buscar oportunidades"}
    </button>
  );
}
