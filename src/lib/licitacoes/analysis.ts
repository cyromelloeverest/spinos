import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { withOrgContext } from "@/lib/db/with-org-context";
import { logError } from "@/lib/log-error";
import type { Prisma } from "@/generated/prisma/client";
import { TenderAnalysisSchema } from "./analysis-schema";
import { verifySources } from "./analysis-verify";
import { ANALYSIS_SYSTEM_PROMPT, MAX_ANALYSIS_INPUT_CHARS, buildAnalysisPrompt, totalChars } from "./analysis-prompt";
import { estimateCostUSD, DEFAULT_ANALYSIS_MODEL } from "./analysis-cost";

// Análise travada há mais que isso (função derrubada, timeout) é dada como
// falha e o crédito volta.
export const STALE_ANALYSIS_MS = 20 * 60 * 1000; // 20 min (o teto da função é ~13 min)
const ACTIVE = ["PENDENTE", "PROCESSANDO"] as const;

export function analysisModel(): string {
  return process.env.LICITACOES_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
}

// Marca como falha e devolve o crédito UMA vez: a transição de status só
// acontece se a análise ainda estava ativa, então chamar duas vezes (ex.:
// falha + varredura de travadas) nunca devolve em dobro.
export async function failAnalysis(
  analysisId: string,
  organizationId: string,
  message: string,
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUSD: number; model: string },
): Promise<void> {
  await withOrgContext(organizationId, async (tx) => {
    const current = await tx.tenderAnalysis.findFirst({ where: { id: analysisId, organizationId, status: { in: [...ACTIVE] } } });
    if (!current) return;
    const { count } = await tx.tenderAnalysis.updateMany({
      where: { id: analysisId, organizationId, status: { in: [...ACTIVE] } },
      data: {
        status: "FALHOU",
        error: message,
        finishedAt: new Date(),
        creditsCharged: 0,
        ...(usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedCostUSD: usage.estimatedCostUSD, model: usage.model } : {}),
      },
    });
    if (count === 1 && current.creditsCharged > 0) {
      await tx.organization.update({ where: { id: organizationId }, data: { creditBalance: { increment: current.creditsCharged } } });
    }
  });
}

// Chamada nas páginas da licitação: análises ativas há tempo demais viram falha.
export async function reapStaleAnalyses(tenderId: string, organizationId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_ANALYSIS_MS);
  const stale = await withOrgContext(organizationId, (tx) =>
    tx.tenderAnalysis.findMany({ where: { tenderId, organizationId, status: { in: [...ACTIVE] }, createdAt: { lt: cutoff } }, select: { id: true } }),
  );
  for (const a of stale) await failAnalysis(a.id, organizationId, "A análise demorou mais que o esperado e foi cancelada. O crédito foi devolvido.");
}

export async function runTenderAnalysis(analysisId: string, organizationId: string): Promise<void> {
  const model = analysisModel();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

    const loaded = await withOrgContext(organizationId, async (tx) => {
      const analysis = await tx.tenderAnalysis.findFirst({ where: { id: analysisId, organizationId } });
      if (!analysis) return null;
      const started = await tx.tenderAnalysis.updateMany({
        where: { id: analysisId, organizationId, status: "PENDENTE" },
        data: { status: "PROCESSANDO", startedAt: new Date(), model },
      });
      if (started.count === 0) return null; // outra execução já pegou
      const tender = await tx.tender.findFirst({
        where: { id: analysis.tenderId, organizationId },
        include: {
          documents: {
            where: { extractionStatus: "OK" },
            orderBy: { createdAt: "asc" },
            include: { pages: { orderBy: { page: "asc" }, select: { page: true, text: true } } },
          },
        },
      });
      return tender;
    });
    if (!loaded) return;

    const docs = loaded.documents.map((d) => ({ fileName: d.fileName, kind: d.kind, pages: d.pages.map((p) => p.text) }));
    if (docs.length === 0) return failAnalysis(analysisId, organizationId, "Nenhum documento com texto extraído para analisar.");
    if (totalChars(docs) > MAX_ANALYSIS_INPUT_CHARS) {
      return failAnalysis(analysisId, organizationId, "O conjunto de documentos é grande demais para uma análise. Remova anexos menos relevantes e tente de novo.");
    }

    const client = new Anthropic({ apiKey });
    // Streaming: a entrada pode ter centenas de milhares de tokens e a
    // resposta leva minutos — sem streaming a requisição estouraria o timeout HTTP.
    const stream = client.messages.stream({
      model,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: ANALYSIS_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(TenderAnalysisSchema) },
      messages: [{ role: "user", content: buildAnalysisPrompt(loaded, docs) }],
    });
    const response = await stream.finalMessage();

    const inputTokens = (response.usage.input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0);
    const outputTokens = response.usage.output_tokens;
    const usage = { inputTokens, outputTokens, estimatedCostUSD: estimateCostUSD(model, response.usage), model };

    if (response.stop_reason === "refusal") return failAnalysis(analysisId, organizationId, "A IA não pôde analisar este conteúdo.", usage);
    if (response.stop_reason === "max_tokens") return failAnalysis(analysisId, organizationId, "A resposta da IA foi cortada por ser muito longa. Tente novamente.", usage);

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    let parsed;
    try {
      parsed = TenderAnalysisSchema.safeParse(JSON.parse(textBlock?.text ?? ""));
    } catch {
      parsed = null;
    }
    if (!parsed?.success) return failAnalysis(analysisId, organizationId, "A IA não retornou um resultado estruturado válido. Tente novamente.", usage);

    const sourceCheck = verifySources(parsed.data, loaded.documents.map((d) => ({ fileName: d.fileName, pages: d.pages.map((p) => p.text) })));

    await withOrgContext(organizationId, (tx) =>
      tx.tenderAnalysis.updateMany({
        where: { id: analysisId, organizationId, status: "PROCESSANDO" },
        data: {
          status: "CONCLUIDA",
          result: parsed.data as Prisma.InputJsonValue,
          sourceCheck: sourceCheck as unknown as Prisma.InputJsonValue,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUSD: usage.estimatedCostUSD,
          model,
          finishedAt: new Date(),
        },
      }),
    );
  } catch (err) {
    // Mensagem da API nunca vai pro cliente (pode expor estado de billing nosso).
    logError("licitacoes: falha na análise", err, { analysisId, organizationId });
    await failAnalysis(analysisId, organizationId, "Não foi possível concluir a análise agora. O crédito foi devolvido. Tente novamente em instantes.").catch((e) =>
      logError("licitacoes: falha ao registrar erro da análise", e, { analysisId, organizationId }),
    );
  }
}
