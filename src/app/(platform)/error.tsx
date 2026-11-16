"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Algo deu errado"
      message="Não conseguimos carregar esta página. Tente novamente ou volte pro login."
      onRetry={reset}
      secondaryAction={{ label: "Voltar ao login", href: "/login" }}
    />
  );
}
