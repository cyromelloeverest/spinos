"use client";

import { useFormStatus } from "react-dom";

// Trava o botão depois do primeiro clique — sem isso, um duplo-clique (ou
// reenvio impaciente) manda uma segunda submissão com o mesmo token, que
// já foi consumido pela primeira. A segunda falha com "link expirado" mesmo
// quando a primeira já confirmou com sucesso — confuso, mas inofensivo.
export function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border-0"
      style={{
        background: pending ? "var(--card-hover)" : "var(--primary)",
        color: pending ? "var(--fg-faint)" : "#ffffff",
        cursor: pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Confirmando…" : "Confirmar agora"}
    </button>
  );
}
