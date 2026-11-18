import { Trophy } from "lucide-react";
import type { Attention } from "@/lib/crm/attention";
import { formatBRL } from "@/lib/crm/money";

type SummaryStage = { key: string; name: string; kind: "OPEN" | "WON" | "LOST"; count: number };

// Mesma escala das colunas do quadro, em tons mais claros para o fundo escuro.
const OPEN_TONES_ON_DARK = ["#E1EAFF", "#C2D4FF", "#9DBBFF", "#6E9AFF", "#4A7FFF", "#2E6BFF"];

function tonesOnDark(stages: SummaryStage[]): string[] {
  const openCount = stages.filter((s) => s.kind === "OPEN").length + 1; // + coluna "Oportunidades"
  let i = 1; // a primeira etapa do funil é a coluna "Oportunidades"
  return stages.map((s) => {
    if (s.kind === "WON") return "#34D399";
    if (s.kind === "LOST") return "#F87171";
    const k = openCount <= 1 ? 3 : Math.round(i++ * ((OPEN_TONES_ON_DARK.length - 1) / (openCount - 1)));
    return OPEN_TONES_ON_DARK[k]!;
  });
}

// Resumo do topo: quanto está em negociação, quanto foi ganho nos últimos 30 dias e o funil numa barra.
export function PipelineSummary({ attention, stages }: { attention: Attention; stages: SummaryStage[] }) {
  const tones = tonesOnDark(stages);
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="px-4 md:px-10 mt-5">
      <div className="rounded-[20px] p-5 md:p-6" style={{ background: "var(--dark)", color: "#ffffff" }}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <div className="text-[11px] uppercase font-semibold" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}>
              Em negociação
            </div>
            <div className="text-[30px] font-bold leading-tight mt-1 tabular-nums">{formatBRL(attention.openValueBRL)}</div>
            <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {attention.openCount} {attention.openCount === 1 ? "oportunidade aberta" : "oportunidades abertas"}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[14px] px-4 py-3" style={{ background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "rgba(52,211,153,0.15)", color: "#34D399" }}>
              <Trophy size={18} strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-[11.5px]" style={{ color: "rgba(255,255,255,0.65)" }}>Ganho nos últimos 30 dias</div>
              <div className="text-[18px] font-bold leading-tight tabular-nums">{formatBRL(attention.wonLast30dValueBRL)}</div>
            </div>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-5 flex h-2.5 gap-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} role="img" aria-label="Distribuição das oportunidades por etapa">
            {stages.map((s, i) =>
              s.count > 0 ? (
                <span key={s.key} className="h-full rounded-full" style={{ flexGrow: s.count, flexBasis: 0, minWidth: 10, background: tones[i] }} />
              ) : null,
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {stages.map((s, i) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-2 h-8 rounded-full pl-2.5 pr-3 text-[12px] font-medium"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.88)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: tones[i] }} />
              {s.name}
              <span className="tabular-nums" style={{ color: "rgba(255,255,255,0.55)" }}>{s.count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
