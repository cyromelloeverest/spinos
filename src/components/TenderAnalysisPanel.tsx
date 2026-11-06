"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startTenderAnalysis } from "@/lib/actions/licitacoes-analise";

export function TenderAnalysisPanel({ tenderId, active, canStart, cost, balance }: { tenderId: string; active: boolean; canStart: boolean; cost: number; balance: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enquanto a análise roda, recarrega os dados da página a cada 5s.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [active, router]);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await startTenderAnalysis(tenderId);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      {active ? (
        <div className="text-[13px]" style={{ color: "var(--fg-muted)" }} role="status">
          Analisando os documentos… isso pode levar alguns minutos. Você pode sair desta página, o resultado fica salvo aqui.
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            Cada análise custa {cost} créditos. Saldo atual: {balance}. Se a análise falhar, o crédito volta.
          </div>
          <button
            type="button"
            onClick={start}
            disabled={busy || !canStart}
            className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer"
            style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff", opacity: busy || !canStart ? 0.5 : 1 }}
          >
            {busy ? "Iniciando…" : "Analisar edital"}
          </button>
        </div>
      )}
      {error && (
        <div className="mt-3 text-[12.5px]" style={{ color: "var(--critical)" }} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
