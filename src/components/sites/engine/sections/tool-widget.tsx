"use client";

import { useEffect, useState } from "react";

type Result = { upTo: number; title: string; text?: string };
type Defaults = { goal: number; ticket: number; closeRate: number; leadRate: number };
type Waste = { area: number; perM2: number; container: number; containers: number[]; classes: { a: number; b: number; cd: number } };

type Props = {
  id: string;
  variant: "quiz" | "calculator" | "checklist" | "waste";
  label: string;
  questions: string[];
  results: Result[];
  items: string[];
  defaults: Defaults;
  waste: Waste;
  note?: string;
};

const ANSWERS = [
  { value: 0, label: "Não" },
  { value: 1, label: "Em parte" },
  { value: 2, label: "Sim" },
] as const;

const FALLBACK_RESULTS: Result[] = [
  { upTo: 40, title: "Base ainda em construção", text: "A operação depende de ações isoladas. O primeiro passo é definir prioridade e direção." },
  { upTo: 75, title: "Base parcial", text: "Existem bons sinais, mas partes importantes ainda não conversam entre si." },
  { upTo: 100, title: "Base clara", text: "A operação tem direção. O ganho agora está em medir e ajustar com constância." },
];

const brl = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/**
 * Each tool on the page writes a one-line summary of its answers into the
 * hidden "context" field of every lead form on the page, so the team sees
 * what the visitor filled in when the contact arrives.
 */
const summaries = new Map<string, string>();
function publish(id: string, summary: string | null) {
  if (summary) summaries.set(id, summary);
  else summaries.delete(id);
  const text = [...summaries.values()].join("\n").slice(0, 1500);
  for (const input of document.querySelectorAll<HTMLInputElement>('form[action="/api/lead"] input[name="context"]')) input.value = text;
}

export function ToolWidget(raw: Props) {
  // "Seu site ajuda o negócio?" reads better as "Seu site ajuda o negócio: 5 de 8".
  const props = { ...raw, label: raw.label.replace(/[.?!:\s]+$/, "") };
  if (props.variant === "quiz") return <Quiz {...props} />;
  if (props.variant === "calculator") return <Calculator {...props} />;
  if (props.variant === "waste") return <WasteCalculator {...props} />;
  return <Checklist {...props} />;
}

function Panel({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="tool-panel reveal rounded-[calc(var(--brand-radius)*1.2)] border p-6 sm:p-9">
      {children}
      {note && <p className="mt-6 text-sm leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

function Quiz({ id, label, questions, results, note }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const done = answers.every((a) => a !== null);
  const points = answers.reduce<number>((n, a) => n + (a ?? 0), 0);
  const pct = Math.round((points / (questions.length * 2)) * 100);
  const bands = [...(results.length ? results : FALLBACK_RESULTS)].sort((a, b) => a.upTo - b.upTo);
  const reading = bands.find((b) => pct <= b.upTo) ?? bands.at(-1)!;

  useEffect(() => {
    publish(id, done ? `${label}: ${pct}% (${reading.title}). ${questions.map((q, i) => `${q} ${ANSWERS[answers[i]!]!.label}`).join(" | ")}` : null);
  }, [id, label, done, pct, reading.title, questions, answers]);

  return (
    <Panel note={note}>
      <ol className="space-y-6">
        {questions.map((q, i) => (
          <li key={q}>
            <fieldset>
              <legend className="font-medium leading-snug">
                <span className="mr-2 text-brand-text tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {q}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {ANSWERS.map((a) => (
                  <label key={a.value} className="tool-choice cursor-pointer">
                    <input
                      type="radio"
                      className="peer sr-only"
                      name={`${id}-${i}`}
                      checked={answers[i] === a.value}
                      onChange={() => setAnswers((prev) => prev.map((v, j) => (j === i ? a.value : v)))}
                    />
                    <span className="inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition peer-checked:border-transparent peer-checked:bg-brand peer-checked:text-brand-contrast peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                      {a.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="tool-result mt-8 rounded-[var(--brand-radius)] border p-6" aria-live="polite">
        {done ? (
          <>
            <p className="font-heading text-4xl font-semibold tabular-nums text-brand-text">{pct}%</p>
            <p className="mt-2 text-lg font-semibold">{reading.title}</p>
            {reading.text && <p className="mt-2 leading-relaxed text-muted">{reading.text}</p>}
          </>
        ) : (
          <p className="text-muted">
            Responda todas as perguntas para ver a leitura inicial ({answers.filter((a) => a !== null).length} de {questions.length}).
          </p>
        )}
      </div>
    </Panel>
  );
}

function Calculator({ id, label, defaults, note }: Props) {
  const [values, setValues] = useState(defaults);
  const sales = values.ticket > 0 ? Math.ceil(values.goal / values.ticket) : 0;
  const opportunities = values.closeRate > 0 ? Math.ceil(sales / (values.closeRate / 100)) : 0;
  const leads = values.leadRate > 0 ? Math.ceil(opportunities / (values.leadRate / 100)) : 0;

  useEffect(() => {
    publish(
      id,
      `${label}: meta R$ ${brl.format(values.goal)}, ticket R$ ${brl.format(values.ticket)}, conversão ${values.closeRate}% e ${values.leadRate}% → ${sales} vendas, ${opportunities} oportunidades, ${leads} leads`,
    );
  }, [id, label, values, sales, opportunities, leads]);

  const input = (key: keyof Defaults, text: string, suffix: string, max: number) => (
    <label className="block">
      <span className="text-sm font-semibold">{text}</span>
      <span className="tool-input mt-2 flex items-center rounded-[var(--brand-radius)] border px-4">
        {suffix === "R$" && <span className="mr-2 text-muted">R$</span>}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: Math.min(max, Math.max(0, Number(e.target.value) || 0)) }))}
          className="min-h-12 w-full bg-transparent tabular-nums outline-none"
        />
        {suffix === "%" && <span className="ml-2 text-muted">%</span>}
      </span>
    </label>
  );

  return (
    <Panel note={note}>
      <div className="grid gap-5 sm:grid-cols-2">
        {input("goal", "Meta de nova receita", "R$", 1_000_000_000)}
        {input("ticket", "Ticket médio", "R$", 1_000_000_000)}
        {input("closeRate", "Oportunidade → venda", "%", 100)}
        {input("leadRate", "Lead → oportunidade", "%", 100)}
      </div>
      <dl className="mt-8 grid grid-cols-3 gap-3" aria-live="polite">
        {[
          ["Vendas", sales],
          ["Oportunidades", opportunities],
          ["Leads", leads],
        ].map(([name, n]) => (
          <div key={name} className="tool-result rounded-[var(--brand-radius)] border p-4 sm:p-5">
            <dt className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{name}</dt>
            <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums text-brand-text sm:text-4xl">{brl.format(Number(n))}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

const m3 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Construction waste: built area × m³ per m², containers by size and the split by class. */
function WasteCalculator({ id, label, waste, note }: Props) {
  const [area, setArea] = useState(waste.area);
  const [size, setSize] = useState(waste.containers.includes(waste.container) ? waste.container : waste.containers[0]!);
  const volume = area * waste.perM2;
  const trips = size > 0 ? Math.ceil(volume / size) : 0;
  const classes = [
    { name: "Classe A", detail: "concreto e alvenaria", pct: waste.classes.a },
    { name: "Classe B", detail: "madeira, plástico, papelão", pct: waste.classes.b },
    { name: "Classes C e D", detail: "gesso, tintas, outros", pct: waste.classes.cd },
  ];

  useEffect(() => {
    publish(id, area > 0 ? `${label}: obra de ${m3.format(area)} m² → cerca de ${m3.format(volume)} m³ de resíduo, ${trips} caçambas de ${size} m³` : null);
  }, [id, label, area, volume, trips, size]);

  return (
    <Panel note={note}>
      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
        <label className="block">
          <span className="text-sm font-semibold">Área construída da obra</span>
          <span className="tool-input mt-2 flex items-center rounded-[var(--brand-radius)] border px-4">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={10_000_000}
              value={area}
              onChange={(e) => setArea(Math.min(10_000_000, Math.max(0, Number(e.target.value) || 0)))}
              className="min-h-12 w-full bg-transparent tabular-nums outline-none"
            />
            <span className="ml-2 text-muted">m²</span>
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Tamanho da caçamba</span>
          <span className="tool-input mt-2 flex items-center rounded-[var(--brand-radius)] border px-4">
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="min-h-12 w-full bg-transparent outline-none">
              {waste.containers.map((c) => (
                <option key={c} value={c}>
                  {c} m³
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <dl className="mt-8 grid grid-cols-2 gap-3" aria-live="polite">
        <div className="tool-result rounded-[var(--brand-radius)] border p-4 sm:p-5">
          <dt className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Resíduo estimado</dt>
          <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums text-brand-text sm:text-4xl">{m3.format(volume)} m³</dd>
        </div>
        <div className="tool-result rounded-[var(--brand-radius)] border p-4 sm:p-5">
          <dt className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Caçambas de {size} m³</dt>
          <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums text-brand-text sm:text-4xl">{brl.format(trips)}</dd>
        </div>
      </dl>
      <ul className="mt-6 space-y-3">
        {classes.map((c) => (
          <li key={c.name}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span>
                <strong>{c.name}</strong> <span className="text-muted">· {c.detail}</span>
              </span>
              <span className="tabular-nums font-semibold">{m3.format((volume * c.pct) / 100)} m³</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
              <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${c.pct}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Checklist({ id, label, items, note }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const count = checked.filter(Boolean).length;
  const pct = Math.round((count / items.length) * 100);

  useEffect(() => {
    const missing = items.filter((_, i) => !checked[i]);
    publish(id, count ? `${label}: ${count} de ${items.length}. Pendentes: ${missing.join(" | ") || "nenhum"}` : null);
  }, [id, label, items, checked, count]);

  return (
    <Panel note={note}>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item}>
            <label className="tool-choice flex cursor-pointer items-start gap-4 rounded-[var(--brand-radius)] border p-4 transition">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[var(--brand-primary)]"
                checked={checked[i]}
                onChange={() => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              />
              <span className="leading-snug">{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="tool-result mt-8 flex items-center gap-6 rounded-[var(--brand-radius)] border p-6" aria-live="polite">
        <p className="font-heading text-4xl font-semibold tabular-nums text-brand-text">{pct}%</p>
        <p className="leading-relaxed text-muted">
          {count} de {items.length} pontos confirmados. Os itens pendentes são uma lista objetiva para a próxima revisão.
        </p>
      </div>
    </Panel>
  );
}
