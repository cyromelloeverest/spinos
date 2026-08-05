"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Check, Copy } from "lucide-react";
import { linkedinPersonSearchUrl } from "@/lib/linkedin";
import { LinkedInButton } from "./LinkedInButton";
import { SpinosScore } from "./SpinosScore";

export function ScriptCard({
  companyName,
  city,
  state,
  score,
  script,
  personName,
}: {
  companyName: string;
  city: string | null;
  state: string | null;
  score: number;
  script: string;
  personName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-[16px] border" style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer"
        style={{ background: "transparent", border: "none" }}
      >
        <SpinosScore value={score} variant="compact" />
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold" style={{ color: "var(--fg)" }}>
            {companyName}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
            {city}, {state}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[12.5px] flex-shrink-0" style={{ color: "var(--fg-faint)" }}>
          {open ? "Fechar" : "Ver script"}
          {open ? <ChevronUp size={14} strokeWidth={1.75} /> : <ChevronDown size={14} strokeWidth={1.75} />}
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
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-4 py-2 border cursor-pointer"
              style={{
                background: "var(--primary-soft)",
                color: "var(--primary)",
                borderColor: "transparent",
              }}
            >
              {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
              {copied ? "Copiado" : "Copiar script"}
            </button>
            <LinkedInButton href={linkedinPersonSearchUrl(personName || "", companyName)} label="Buscar no LinkedIn" />
          </div>
        </div>
      )}
    </div>
  );
}
