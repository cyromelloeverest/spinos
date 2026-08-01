"use client";

import { useState } from "react";

export function ScriptCard({
  companyName,
  city,
  state,
  score,
  script,
}: {
  companyName: string;
  city: string | null;
  state: string | null;
  score: number;
  script: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer"
        style={{ background: "transparent", border: "none" }}
      >
        <div
          className="w-11 h-11 rounded-[9px] flex items-center justify-center border font-semibold text-[16px] flex-shrink-0"
          style={{
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            background: "var(--card-hover)",
            color: "var(--fg-muted)",
            borderColor: "var(--border)",
          }}
        >
          {score}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold" style={{ color: "var(--fg)" }}>
            {companyName}
          </div>
          <div className="text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>
            {city}, {state}
          </div>
        </div>
        <div className="text-[12.5px] flex-shrink-0" style={{ color: "var(--fg-faint)" }}>
          {open ? "Fechar ▲" : "Ver script ▼"}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5">
          <pre
            className="whitespace-pre-wrap text-[13px] leading-[1.6] rounded-[10px] border p-4 m-0"
            style={{ background: "var(--card-hover)", borderColor: "var(--border)", color: "var(--fg)", fontFamily: "var(--font-body)" }}
          >
            {script}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 text-[12.5px] font-semibold rounded-full px-4 py-2 border cursor-pointer"
            style={{
              background: copied ? "var(--good-soft)" : "var(--copper-soft)",
              color: copied ? "var(--good)" : "var(--copper)",
              borderColor: "transparent",
            }}
          >
            {copied ? "Copiado ✓" : "Copiar script"}
          </button>
        </div>
      )}
    </div>
  );
}
