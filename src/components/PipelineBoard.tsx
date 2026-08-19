"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setStage, type LossReason } from "@/lib/actions/pipeline";
import { SpinosScore } from "./SpinosScore";
import {
  PIPELINE_STAGE_ORDER,
  PIPELINE_STAGE_LABEL,
  pipelineStageColor,
  NOVA_STAGE_ID,
  NOVA_STAGE_LABEL,
} from "@/lib/pipeline-stages";

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

const COLUMNS = [
  { stage: NOVA_STAGE_ID, label: NOVA_STAGE_LABEL },
  ...PIPELINE_STAGE_ORDER.map((stage) => ({ stage, label: PIPELINE_STAGE_LABEL[stage] })),
];

const LOSS_REASONS: { value: LossReason; label: string }[] = [
  { value: "NOT_INTERESTED", label: "Não teve interesse" },
  { value: "WRONG_FIT", label: "Fora do perfil ideal" },
  { value: "NO_RESPONSE", label: "Sem resposta" },
];

export function PipelineBoard({ initialCards }: { initialCards: PipelineCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [pendingLoss, setPendingLoss] = useState<{ cardId: string; companyName: string } | null>(null);
  const [, startTransition] = useTransition();

  function applyStage(cardId: string, targetStage: string, lossReason?: LossReason, lossNotes?: string) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stage: targetStage } : c)));
    startTransition(() => {
      setStage(cardId, targetStage, lossReason, lossNotes);
    });
  }

  function handleDrop(targetStage: string, cardId: string) {
    setDragOverStage(null);
    if (targetStage === "PERDIDO") {
      const card = cards.find((c) => c.id === cardId);
      if (card) setPendingLoss({ cardId, companyName: card.companyName });
      return;
    }
    applyStage(cardId, targetStage);
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
                  color: pipelineStageColor(col.stage, "var(--fg-muted)"),
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
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="text-[13.5px] font-semibold flex-1 min-w-0 truncate">{card.companyName}</div>
                      <SpinosScore value={card.score} variant="inline" />
                    </div>
                    <div className="text-[11px] mb-1" style={{ color: "var(--fg-faint)" }}>
                      {card.daysLabel}
                      {card.lastActionByName && ` · por ${card.lastActionByName}`}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--fg-faint)" }}>
                      {card.city}, {card.state}
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

      {pendingLoss && (
        <LossReasonModal
          companyName={pendingLoss.companyName}
          onCancel={() => setPendingLoss(null)}
          onConfirm={(reason, notes) => {
            applyStage(pendingLoss.cardId, "PERDIDO", reason, notes);
            setPendingLoss(null);
          }}
        />
      )}
    </div>
  );
}

function LossReasonModal({
  companyName,
  onCancel,
  onConfirm,
}: {
  companyName: string;
  onCancel: () => void;
  onConfirm: (reason: LossReason, notes: string) => void;
}) {
  const [reason, setReason] = useState<LossReason | null>(null);
  const [notes, setNotes] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[420px] rounded-[16px] border p-6"
        style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold m-0 mb-1.5">Por que perdeu {companyName}?</h2>
        <p className="text-[12.5px] leading-[1.5] mb-4" style={{ color: "var(--fg-muted)" }}>
          Isso alimenta o motor pra reconhecer padrões parecidos nas próximas buscas — é o único dado que a
          concorrência não tem acesso.
        </p>

        <div className="flex flex-col gap-2 mb-4">
          {LOSS_REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              className="text-left text-[13px] font-medium px-3.5 py-2.5 rounded-[10px] border cursor-pointer"
              style={{
                background: reason === option.value ? "var(--primary-soft)" : "var(--card)",
                borderColor: reason === option.value ? "var(--primary)" : "var(--border)",
                color: reason === option.value ? "var(--primary)" : "var(--fg)",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Detalhe opcional (o que disseram, o que faltou etc.)"
          rows={3}
          className="w-full text-[13px] rounded-[10px] border px-3 py-2.5 mb-5 resize-none"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--fg)", fontFamily: "inherit" }}
        />

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!reason}
            onClick={() => reason && onConfirm(reason, notes)}
            className="flex-1 text-[13.5px] font-semibold rounded-[12px] px-4 py-2.5 border-0"
            style={{
              background: reason ? "var(--critical)" : "var(--card-hover)",
              color: reason ? "#ffffff" : "var(--fg-faint)",
              cursor: reason ? "pointer" : "not-allowed",
            }}
          >
            Marcar como perdida
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[13.5px] font-medium rounded-[12px] px-4 py-2.5 border cursor-pointer"
            style={{ background: "transparent", color: "var(--fg-muted)", borderColor: "var(--border)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
