"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Algo deu errado"
      message="Não conseguimos carregar esta página. Tente novamente ou volte ao início."
      onRetry={reset}
      secondaryAction={{ label: "Voltar ao início", href: "/" }}
    />
  );
}
