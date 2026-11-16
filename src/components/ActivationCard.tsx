import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { ActivationStep } from "@/lib/onboarding/activation";
import { activationProgress } from "@/lib/onboarding/activation";

// Primeiros passos no painel: some sozinho quando tudo que é obrigatório está feito.
export function ActivationCard({ steps }: { steps: ActivationStep[] }) {
  const p = activationProgress(steps);
  if (p.complete) return null;
  return (
    <div className="px-4 md:px-10 pt-6">
      <div className="rounded-[16px] border p-5 sm:p-6" style={{ background: "var(--card)", borderColor: "var(--primary-line)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-[16px] font-bold m-0">Primeiros passos</h2>
          <span className="text-[12px]" style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>{p.done} de {p.total}</span>
        </div>
        <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: "var(--border)" }} role="progressbar" aria-valuenow={p.done} aria-valuemin={0} aria-valuemax={p.total} aria-label="Primeiros passos concluídos">
          <div className="h-full rounded-full" style={{ width: `${(p.done / p.total) * 100}%`, background: "var(--primary)" }} />
        </div>
        <ul className="list-none m-0 p-0 grid gap-1">
          {steps.map((s) => (
            <li key={s.key}>
              <Link href={s.href} className="flex items-start gap-3 rounded-[10px] px-2 py-2 no-underline" style={{ color: "var(--fg)", background: p.next?.key === s.key ? "var(--primary-soft)" : "transparent" }}>
                <span className="mt-0.5 flex-shrink-0" style={{ color: s.done ? "var(--good)" : "var(--fg-faint)" }} aria-hidden="true">{s.done ? <Check size={16} strokeWidth={2} /> : <Circle size={16} strokeWidth={1.75} />}</span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold" style={{ textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--fg-muted)" : "var(--fg)" }}>{s.label}{s.optional ? " (opcional)" : ""}</span>
                  {!s.done && <span className="block text-[12.5px]" style={{ color: "var(--fg-muted)" }}>{s.hint}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
