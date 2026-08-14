"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Check, Copy } from "lucide-react";
import { linkedinPersonSearchUrl, linkedinTitleSearchUrl } from "@/lib/linkedin";
import { LinkedInButton } from "./LinkedInButton";
import { SpinosScore } from "./SpinosScore";

export function ScriptCard({
  companyName,
  city,
  state,
  score,
  script,
  personName,
  personTitle,
  highlighted = false,
}: {
  companyName: string;
  city: string | null;
  state: string | null;
  score: number;
  script: string;
  personName?: string | null;
  personTitle?: string | null;
  highlighted?: boolean;
}) {
  const linkedinHref = personName
    ? linkedinPersonSearchUrl(personName, companyName)
    : personTitle
      ? linkedinTitleSearchUrl(personTitle, companyName)
      : null;

  const [open, setOpen] = useState(highlighted);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Card veio de um link direto ("Fale com 1 empresa hoje" no dashboard) —
  // já nasce aberto (acima), e aqui garante que fica visível sem o usuário
  // ter que rolar a lista pra achar.
  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  async function handleCopy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      ref={cardRef}
      className="rounded-[16px] border"
      style={{
        background: "var(--card)",
        borderColor: highlighted ? "var(--primary)" : "var(--border)",
        borderWidth: highlighted ? "1.5px" : "1px",
        boxShadow: highlighted ? "var(--shadow-float)" : "var(--shadow-card)",
      }}
    >
      {highlighted && (
        <div
          className="text-[11px] font-semibold uppercase px-5 pt-3.5 -mb-1"
          style={{ color: "var(--primary)", letterSpacing: "0.04em" }}
        >
          Sugestão de hoje
        </div>
      )}
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
            {linkedinHref && (
              <LinkedInButton href={linkedinHref} label={personName ? "Buscar no LinkedIn" : "Buscar por cargo"} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
