"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { withOrgContext } from "@/lib/db/with-org-context";
import { requireBiddingAccess } from "@/lib/licitacoes/access";
import { logSecurityEvent } from "@/lib/audit/log";
import { runTenderAnalysis, reapStaleAnalyses } from "@/lib/licitacoes/analysis";
import { ANALYSIS_CREDITS } from "@/lib/licitacoes/analysis-cost";

type StartResult = { ok: true } | { ok: false; error: string };

// Cobra os créditos e cria o registro NA MESMA transação (duplo clique não
// gasta duas vezes: a cobrança só passa se ainda houver saldo e nenhuma
// análise estiver rodando). A análise em si roda depois da resposta, via
// after(), e a tela acompanha o status por polling.
export async function startTenderAnalysis(tenderId: string): Promise<StartResult> {
  const { organizationId, userId } = await requireBiddingAccess();

  await reapStaleAnalyses(tenderId, organizationId);

  const outcome = await withOrgContext(organizationId, async (tx) => {
    const tender = await tx.tender.findFirst({ where: { id: tenderId, organizationId }, select: { id: true } });
    if (!tender) return { error: "Licitação não encontrada." } as const;

    const withText = await tx.tenderDocument.count({ where: { tenderId, organizationId, extractionStatus: "OK" } });
    if (withText === 0) return { error: "Envie ao menos um documento com texto (PDF não escaneado) antes de analisar." } as const;

    const active = await tx.tenderAnalysis.count({ where: { tenderId, organizationId, status: { in: ["PENDENTE", "PROCESSANDO"] } } });
    if (active > 0) return { error: "Já existe uma análise em andamento para esta licitação." } as const;

    const charged = await tx.organization.updateMany({
      where: { id: organizationId, creditBalance: { gte: ANALYSIS_CREDITS } },
      data: { creditBalance: { decrement: ANALYSIS_CREDITS } },
    });
    if (charged.count === 0) return { error: `Créditos insuficientes. Cada análise custa ${ANALYSIS_CREDITS} créditos.` } as const;

    const last = await tx.tenderAnalysis.findFirst({ where: { tenderId, organizationId }, orderBy: { version: "desc" }, select: { version: true } });
    const analysis = await tx.tenderAnalysis.create({
      data: { tenderId, organizationId, version: (last?.version ?? 0) + 1, status: "PENDENTE", creditsCharged: ANALYSIS_CREDITS, requestedById: userId },
    });
    return { analysisId: analysis.id } as const;
  });

  const analysisId = outcome.analysisId;
  if (!analysisId) return { ok: false, error: outcome.error ?? "Não foi possível iniciar a análise." };

  await logSecurityEvent({ type: "licitacoes.analysis_started", actorUserId: userId, organizationId, targetId: analysisId, metadata: { tenderId, credits: ANALYSIS_CREDITS } });
  after(() => runTenderAnalysis(analysisId, organizationId));
  revalidatePath(`/licitacoes/${tenderId}`);
  return { ok: true };
}
