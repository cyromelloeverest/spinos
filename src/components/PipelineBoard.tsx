"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setStage } from "@/lib/actions/pipeline";

export type PipelineCard = {
  id: string;
  companyName: string;
  city: string | null;
  state: string | null;
  score: number;
  stage: string;
  daysLabel: string;
  lastActionByName: string | null;
};

const COLUMNS: { stage: string; label: string }[] = [
  { stage: "CONTATO_FEITO", label: "Contato feito" },
  { stage: "VISITA_AGENDADA", label: "Visita agendada" },
  { stage: "PROPOSTA_ENVIADA", label: "Proposta enviada" },
  { stage: "VENDIDO", label: "Vendido" },
  { stage: "PERDIDO", label: "Perdido" },
];

export function PipelineBoard({ initialCards }: { initialCards: PipelineCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDrop(targetStage: string, cardId: string) {
    setDragOverStage(null);
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stage: targetStage } : c)));
    startTransition(() => {
      setStage(cardId, targetStage);
    });
  }

  return (
    <div className="px-10 py-6 flex gap-4 overflow-x-auto">
      {COLUMNS.map((col) => {
        const columnCards = cards.filter((c) => c.stage === col.stage);
        const isDragOver = dragOverStage === col.stage;
        return (
          <div
            key={col.stage}
            className="flex flex-col gap-3 flex-shrink-0"
            style={{ width: "260px" }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverStage !== col.stage) setDragOverStage(col.stage);
            }}
            onDragLeave={() => setDragOverStage((s) => (s === col.stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const cardId = e.dataTransfer.getData("text/plain");
              if (cardId) handleDrop(col.stage, cardId);
            }}
          >
            <div className="flex items-center justify-between px-1">
              <div
                className="text-[12px] font-semibold uppercase"
                style={{
                  color:
                    col.stage === "VENDIDO" ? "var(--good)" : col.stage === "PERDIDO" ? "var(--critical)" : "var(--fg-muted)",
                  letterSpacing: "0.04em",
                }}
              >
                {col.label}
              </div>
              <div
                className="text-[11px] rounded-full px-2 py-0.5"
                style={{ background: "var(--card-hover)", color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}
              >
                {columnCards.length}
              </div>
            </div>

            <div
              className="flex flex-col gap-2.5 rounded-[12px] p-1 transition-colors"
              style={{
                background: isDragOver ? "var(--primary-soft)" : "transparent",
                border: isDragOver ? "1px dashed var(--primary-line)" : "1px dashed transparent",
                minHeight: "60px",
              }}
            >
              {columnCards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", card.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="rounded-[12px] border p-3.5 flex flex-col gap-2.5"
                  style={{ background: "var(--card)", borderColor: "var(--border)", cursor: "grab", boxShadow: "var(--shadow-card)" }}
                >
                  <Link href={`/company/${card.id}`} className="no-underline" style={{ color: "var(--fg)" }}>
                    <div className="text-[13.5px] font-semibold mb-0.5">{card.companyName}</div>
                    <div className="text-[11px] mb-1" style={{ color: "var(--fg-faint)" }}>
                      {card.daysLabel}
                      {card.lastActionByName && ` · por ${card.lastActionByName}`}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--fg-faint)" }}>
                      {card.city}, {card.state} · score {card.score}
                    </div>
                  </Link>
                </div>
              ))}

              {columnCards.length === 0 && (
                <div
                  className="rounded-[10px] border border-dashed p-3.5 text-[12px] text-center"
                  style={{ borderColor: "var(--border)", color: "var(--fg-faint)" }}
                >
                  Arraste um card aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
