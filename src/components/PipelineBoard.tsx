"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setStage, type LossReason } from "@/lib/actions/pipeline";
import { SpinosScore } from "./SpinosScore";
import { NOVA_STAGE_ID, NOVA_STAGE_LABEL } from "@/lib/pipeline-stages";
import { formatBRL } from "@/lib/crm/money";
import { initials } from "@/lib/initials";
import { Trophy } from "lucide-react";

export type PipelineColumn = { key: string; label: string; kind: "OPEN" | "WON" | "LOST" };

// Cor de cada etapa, no padrão do CRM da Everest: uma escala do azul claro (início do funil)
// ao azul profundo (perto de fechar); ganho em verde e perdido em vermelho.
const OPEN_TONES = ["#9DBBFF", "#6E9AFF", "#4A7FFF", "#175CFF", "#1249D1", "#0C2F8A"];
export const WON_TONE = "#059669";
export const LOST_TONE = "#EF4444";

export function stageTones(columns: { kind: PipelineColumn["kind"] | "NOVA" }[]): string[] {
  const openCount = columns.filter((c) => c.kind === "OPEN" || c.kind === "NOVA").length;
  let i = 0;
  return columns.map((c) => {
    if (c.kind === "WON") return WON_TONE;
    if (c.kind === "LOST") return LOST_TONE;
    const k = openCount <= 1 ? 3 : Math.round(i++ * ((OPEN_TONES.length - 1) / (openCount - 1)));
    return OPEN_TONES[k]!;
  });
}

export type PipelineCard = {
  id: string;
  companyName: string;
  city: string | null;
  state: string | null;
  score: number;
  stage: string;
  daysLabel: string;
  lastActionByName: string | null;
  // Negociação (vazios para contas que ainda estão na coluna "Oportunidades").
  hasDeal: boolean;
  valueLabel: string | null;
  valueBRL: number | null;
  ownerInitials: string | null;
  whatsappUrl: string | null;
  noNextStep: boolean;
  overdue: boolean;
  // Lead cadastrado ou vindo de formulário: não tem nota da IA.
  isLead?: boolean;
};


const LOSS_REASONS: { value: LossReason; label: string }[] = [
  { value: "NOT_INTERESTED", label: "Não teve interesse" },
  { value: "WRONG_FIT", label: "Fora do perfil ideal" },
  { value: "NO_RESPONSE", label: "Sem resposta" },
];

export function PipelineBoard({ initialCards, stages, ownerParam }: { initialCards: PipelineCard[]; stages: PipelineColumn[]; ownerParam: "me" | "all" }) {
  // A primeira coluna é sempre "Oportunidades" (contas ainda sem negociação); as
  // demais vêm do funil da organização.
  const COLUMNS: { stage: string; label: string; kind: PipelineColumn["kind"] | "NOVA" }[] = [
    { stage: NOVA_STAGE_ID, label: NOVA_STAGE_LABEL, kind: "NOVA" },
    ...stages.map((st) => ({ stage: st.key, label: st.label, kind: st.kind })),
  ];
  const tones = stageTones(COLUMNS);
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
    if (stages.find((st) => st.key === targetStage)?.kind === "LOST") {
      const card = cards.find((c) => c.id === cardId);
      if (card) setPendingLoss({ cardId, companyName: card.companyName });
      return;
    }
    applyStage(cardId, targetStage);
  }

  return (
    <div className="px-4 md:px-10 pt-5 pb-6 flex gap-4 overflow-x-auto snap-x snap-mandatory md:snap-none">
      {COLUMNS.map((col, colIndex) => {
        const columnCards = cards.filter((c) => c.stage === col.stage);
        const isDragOver = dragOverStage === col.stage;
        const tone = tones[colIndex]!;
        const won = col.kind === "WON";
        const total = columnCards.reduce((sum, c) => sum + (c.valueBRL ?? 0), 0);
        return (
          <section
            key={col.stage}
            aria-label={`${col.label}: ${columnCards.length}`}
            className="flex flex-col flex-shrink-0 snap-start w-[86vw] max-w-[320px] md:w-[288px] rounded-[20px] transition-colors"
            style={{
              background: isDragOver ? "var(--primary-soft)" : "#EEF2F7",
              boxShadow: isDragOver ? "inset 0 0 0 2px var(--primary-line)" : "inset 0 0 0 1px rgba(8,20,38,0.04)",
            }}
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
            <header className="px-3.5 pt-3.5 pb-2.5">
              <span aria-hidden className="block h-1 rounded-full mb-3" style={{ background: tone }} />
              <div className="flex items-center justify-between gap-2">
                <h2 className="m-0 flex items-center gap-2 min-w-0 text-[13.5px] font-semibold" style={{ color: "var(--fg)" }}>
                  {won ? (
                    <Trophy size={15} strokeWidth={2} className="flex-shrink-0" style={{ color: tone }} />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tone }} />
                  )}
                  <span className="truncate">{col.label}</span>
                </h2>
                <span
                  className="min-w-6 text-center text-[12px] font-semibold rounded-full px-2 py-0.5 tabular-nums"
                  style={{ background: "var(--card)", color: "var(--fg-muted)", boxShadow: "var(--shadow-card)" }}
                >
                  {columnCards.length}
                </span>
              </div>
              <p className="m-0 mt-1 text-[12.5px] font-semibold tabular-nums" style={{ color: won ? "var(--good)" : "var(--fg-muted)" }}>
                {formatBRL(total)}
              </p>
            </header>

            <div className="flex flex-col gap-2.5 px-2.5 pb-2.5 flex-1" style={{ minHeight: "96px" }}>
              {columnCards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", card.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="group rounded-[16px] p-3.5 flex flex-col gap-2.5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5"
                  style={{
                    background: "var(--card)",
                    cursor: "grab",
                    boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 2px 6px -2px rgba(16,24,40,.06), inset 0 0 0 1px rgba(8,20,38,0.05)",
                  }}
                >
                  <Link href={`/pipeline?abrir=${card.id}&owner=${ownerParam}`} className="no-underline flex items-start gap-3" style={{ color: "var(--fg)" }}>
                    <span
                      aria-hidden
                      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-bold"
                      style={{ background: `${tone}26`, color: "#0C2F8A", boxShadow: `inset 0 0 0 1px ${tone}55` }}
                    >
                      {won ? <Trophy size={15} strokeWidth={2} style={{ color: tone }} /> : initials(card.companyName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[13.5px] font-semibold flex-1 min-w-0 truncate">{card.companyName}</span>
                        {card.isLead ? <span className="text-[10px] font-semibold uppercase rounded-full px-2 py-[2px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>Lead</span> : <SpinosScore value={card.score} variant="inline" />}
                      </span>
                      <span className="block text-[11.5px]" style={{ color: "var(--fg-muted)" }}>
                        {card.city}, {card.state}
                        {card.daysLabel && ` · ${card.daysLabel}`}
                      </span>
                    </span>
                  </Link>
                  {card.hasDeal && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className={card.valueLabel ? "text-[15px] tabular-nums" : ""} style={{ color: card.valueLabel ? "var(--fg)" : "var(--fg-faint)", fontWeight: card.valueLabel ? 700 : 400 }}>{card.valueLabel ?? "Sem valor"}</span>
                      <span className="flex-1" />
                      {card.whatsappUrl && (
                        <a href={card.whatsappUrl} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${card.companyName}`} className="no-underline text-[11px] font-semibold rounded-full px-2 py-[2px]" style={{ background: "var(--good-soft)", color: "var(--good)" }}>
                          WhatsApp
                        </a>
                      )}
                      {card.ownerInitials && (
                        <span title={card.lastActionByName ?? undefined} className="text-[10px] font-semibold rounded-full inline-flex items-center justify-center" style={{ width: 22, height: 22, background: "var(--sidebar, #0F172A)", color: "#ffffff" }}>
                          {card.ownerInitials}
                        </span>
                      )}
                    </div>
                  )}
                  {card.hasDeal && (card.noNextStep || card.overdue) && (
                    <div>
                      <span className="text-[10.5px] font-semibold rounded-full px-2 py-[2px]" style={{ background: "var(--warn-soft, #FEF3C7)", color: card.overdue ? "var(--critical)" : "var(--warn)" }}>
                        {card.overdue ? "Próximo passo atrasado" : "Definir próximo passo"}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {columnCards.length === 0 && (
                <div
                  className="rounded-[14px] border border-dashed p-3.5 text-[12px] text-center"
                  style={{ borderColor: "var(--border-strong)", color: "var(--fg-faint)" }}
                >
                  Arraste um card aqui
                </div>
              )}
            </div>
          </section>
        );
      })}

      {pendingLoss && (
        <LossReasonModal
          companyName={pendingLoss.companyName}
          onCancel={() => setPendingLoss(null)}
          onConfirm={(reason, notes) => {
            applyStage(pendingLoss.cardId, stages.find((st) => st.kind === "LOST")?.key ?? "PERDIDO", reason, notes);
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
