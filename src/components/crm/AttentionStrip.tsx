import Link from "next/link";
import { AlarmClock, CalendarClock, CircleAlert } from "lucide-react";
import type { Attention } from "@/lib/crm/attention";

function Tile({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: "critical" | "primary" | "warn" }) {
  const color = value === 0 ? "var(--fg-faint)" : tone === "critical" ? "var(--critical)" : tone === "warn" ? "var(--warn)" : "var(--primary)";
  return (
    <div className="flex items-center gap-3 rounded-[16px] border px-4 py-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex-shrink-0" style={{ color }}>{icon}</div>
      <div>
        <div className="text-[18px] font-semibold leading-none" style={{ color: value === 0 ? "var(--fg-muted)" : "var(--fg)" }}>{value}</div>
        <div className="text-[12px] mt-1" style={{ color: "var(--fg-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

// Os três avisos que mantêm o funil andando: o que atrasou, o que vence hoje e as
// negociações abertas sem próximo passo.
export function AttentionStrip({ attention, ownerParam }: { attention: Attention; ownerParam: "me" | "all" }) {
  return (
    <div className="px-4 md:px-10 mt-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Tile icon={<AlarmClock size={20} strokeWidth={1.75} />} value={attention.overdue} label={attention.overdue === 1 ? "atividade atrasada" : "atividades atrasadas"} tone="critical" />
        <Tile icon={<CalendarClock size={20} strokeWidth={1.75} />} value={attention.today} label={attention.today === 1 ? "atividade para hoje" : "atividades para hoje"} tone="primary" />
        <Tile icon={<CircleAlert size={20} strokeWidth={1.75} />} value={attention.noNextStep} label="sem próximo passo" tone="warn" />
      </div>
      <div className="mt-3 flex items-center gap-1 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
        <span>Mostrando:</span>
        <Link href="/pipeline?owner=me" className="no-underline px-3 py-1.5 rounded-[10px] font-semibold" style={{ background: ownerParam === "me" ? "var(--primary)" : "transparent", color: ownerParam === "me" ? "#ffffff" : "var(--fg-muted)" }}>
          Minhas
        </Link>
        <Link href="/pipeline?owner=all" className="no-underline px-3 py-1.5 rounded-[10px] font-semibold" style={{ background: ownerParam === "all" ? "var(--primary)" : "transparent", color: ownerParam === "all" ? "#ffffff" : "var(--fg-muted)" }}>
          Toda a equipe
        </Link>
      </div>
    </div>
  );
}
