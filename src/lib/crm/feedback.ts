import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;
export type LossReasonKey = "NOT_INTERESTED" | "WRONG_FIT" | "NO_RESPONSE";

// O Feedback é o único sinal de calibração que nenhum concorrente tem, então
// precisa ficar sempre consistente com a etapa real: ganho grava CONVERTED, perda
// grava o motivo, e sair de um estágio terminal apaga o registro antigo.
export async function syncFeedback(
  tx: Tx,
  input: { organizationId: string; companyId: string; scoreId: string; kind: "OPEN" | "WON" | "LOST" | "NOVA"; lossReason?: LossReasonKey; lossNotes?: string | null },
) {
  const { organizationId, companyId, scoreId, kind } = input;
  if (kind === "WON") {
    await tx.feedback.upsert({
      where: { opportunityScoreId: scoreId },
      update: { outcome: "CONVERTED", notes: null },
      create: { organizationId, companyId, opportunityScoreId: scoreId, outcome: "CONVERTED" },
    });
  } else if (kind === "LOST") {
    const outcome = input.lossReason ?? "NOT_INTERESTED";
    const notes = input.lossNotes?.trim() || null;
    await tx.feedback.upsert({
      where: { opportunityScoreId: scoreId },
      update: { outcome, notes },
      create: { organizationId, companyId, opportunityScoreId: scoreId, outcome, notes },
    });
  } else {
    await tx.feedback.deleteMany({ where: { opportunityScoreId: scoreId } });
  }
}
