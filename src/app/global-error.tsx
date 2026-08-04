"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "-apple-system, 'Segoe UI', Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 24px", maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 12px", color: "#111827" }}>
            Algo deu muito errado
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#6b7280", margin: "0 0 24px" }}>
            Ocorreu um erro inesperado na aplicação. Tente recarregar a página.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              border: 0,
              borderRadius: 12,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
