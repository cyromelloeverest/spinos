import type { Attention } from "@/lib/crm/attention";
import { formatBRL } from "@/lib/crm/money";

// Resumo do topo: quanto está em negociação e quanto foi ganho nos últimos 30 dias.
export function PipelineSummary({ attention, stages }: { attention: Attention; stages: { key: string; name: string; count: number }[] }) {
  return (
    <div className="px-4 md:px-10 mt-5">
      <div className="rounded-[16px] p-5 flex flex-wrap items-end justify-between gap-4" style={{ background: "var(--sidebar, #0F172A)", color: "#ffffff" }}>
        <div>
          <div className="text-[11px] uppercase font-medium" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em" }}>
            Em negociação
          </div>
          <div className="text-[28px] font-semibold leading-tight mt-1">{formatBRL(attention.openValueBRL)}</div>
          <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            {attention.openCount} {attention.openCount === 1 ? "oportunidade aberta" : "oportunidades abertas"}
          </div>
        </div>
        <div className="rounded-[12px] px-4 py-3" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="text-[11.5px]" style={{ color: "rgba(255,255,255,0.65)" }}>Ganho nos últimos 30 dias</div>
          <div className="text-[18px] font-semibold">{formatBRL(attention.wonLast30dValueBRL)}</div>
        </div>
        <div className="w-full flex flex-wrap gap-2">
          {stages.map((st) => (
            <span key={st.key} className="text-[12px] rounded-full px-3 py-1" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }}>
              {st.name} <strong style={{ marginLeft: 4 }}>{st.count}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
