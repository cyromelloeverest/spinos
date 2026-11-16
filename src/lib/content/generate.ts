import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { withOrgContext } from "@/lib/db/with-org-context";
import { effectiveContentLimit } from "@/lib/trial";
import { DEFAULT_PACK_KEY, getPack } from "@/packs/registry";
import type { NichePack } from "@/packs/schema";
import { logError } from "@/lib/log-error";
import { buildContentPrompt } from "./prompt";
import { buildSignature, runChecks } from "./checks";
import { requestSchema, type ContentRequest, type ModelCall } from "./schema";

export type GenerateOutcome =
  | { status: "ok"; generationId: string; count: number }
  | { status: "invalid"; message: string }
  | { status: "limit"; limit: number; trialing: boolean }
  | { status: "error"; message: string };

const startOfMonth = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** O pacote vigente do nicho da organização (o arquivo atual, não a cópia gravada na instalação). */
export function packForKey(key: string | null | undefined): NichePack | null {
  return getPack(key) ?? getPack(DEFAULT_PACK_KEY);
}

/**
 * Gera rascunhos de conteúdo. Ordem: valida o pedido, confere o teto do plano (ou consome 1 crédito do
 * saldo pré-pago), chama a IA FORA de transação (leva segundos), grava os rascunhos com avisos e
 * assinatura. Se a IA falhar, devolve o crédito: o cliente não paga por nada que não recebeu.
 */
export async function generateContent(
  organizationId: string,
  userId: string | null,
  rawRequest: unknown,
  callModel: ModelCall,
  now: Date = new Date(),
): Promise<GenerateOutcome> {
  const parsed = requestSchema.safeParse(rawRequest);
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0]?.message ?? "Pedido inválido." };
  const request: ContentRequest = parsed.data;

  const generationId = randomUUID();
  const pre = await withOrgContext(organizationId, async (tx) => {
    // Um pedido por vez por organização na hora de conferir o teto: sem isso, 20 cliques simultâneos
    // passam todos pela conferência antes de qualquer rascunho existir, e cada um custa uma chamada à IA.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
    const org = await tx.organization.findUnique({ where: { id: organizationId } });
    if (!org) return { status: "error" as const, message: "Organização não encontrada." };
    const { max, isTrialing } = effectiveContentLimit(org);
    // Cada pedido é um uso, mesmo que gere várias linhas (as 5 ideias dividem o mesmo generationId).
    const used = (
      await tx.contentDraft.groupBy({ by: ["generationId"], where: isTrialing ? { organizationId } : { organizationId, createdAt: { gte: startOfMonth(now) } } })
    ).length;
    let usedCredit = false;
    if (used >= max) {
      // Mesmo critério da busca: Enterprise pago não compra crédito avulso acima do teto (é conversa comercial).
      const creditAllowed = isTrialing || org.plan !== "ENTERPRISE";
      // O desconto só vale se ainda havia saldo NO MOMENTO da escrita: o saldo nunca fica negativo.
      const debited = creditAllowed ? await tx.organization.updateMany({ where: { id: organizationId, creditBalance: { gt: 0 } }, data: { creditBalance: { decrement: 1 } } }) : { count: 0 };
      if (debited.count === 0) return { status: "limit" as const, limit: max, trialing: isTrialing };
      usedCredit = true;
    }
    // Reserva o uso JÁ, na mesma transação: o pedido seguinte enxerga este e conta. A linha vira o
    // rascunho de verdade quando a IA responde, ou some se a IA falhar.
    await tx.contentDraft.create({ data: { organizationId, generationId, kind: request.kind, status: "DISCARDED", topic: request.topic, title: "(gerando)", body: "", usedCredit, createdByUserId: userId } });
    const installed = await tx.organizationPack.findUnique({ where: { organizationId }, select: { packKey: true } });
    return { status: "go" as const, org, usedCredit, packKey: installed?.packKey ?? null };
  });
  if (pre.status === "error") return pre;
  if (pre.status === "limit") return pre;

  const pack = packForKey(pre.packKey);
  // Falhou: libera o uso reservado e devolve o crédito, se havia um.
  const refund = () =>
    withOrgContext(organizationId, async (tx) => {
      await tx.contentDraft.deleteMany({ where: { organizationId, generationId, body: "" } });
      if (pre.usedCredit) await tx.organization.update({ where: { id: organizationId }, data: { creditBalance: { increment: 1 } } });
    }).catch((e) => logError("content: falha ao liberar a reserva", e, { organizationId }));

  let result;
  try {
    const prompt = buildContentPrompt(pre.org, pack, request);
    // Pesquisa na web só para texto que cita fato (artigo, e-mail, post); ideias não precisam.
    result = await callModel({ prompt, kind: request.kind, useSearch: request.kind !== "IDEA" });
  } catch (err) {
    await refund();
    // O detalhe da API pode conter estado interno de cobrança: fica só no log do servidor.
    logError("content: falha ao chamar a IA", err, { organizationId });
    return { status: "error", message: "Não foi possível gerar agora. Tente de novo em instantes." };
  }

  const base = { organizationId, generationId, topic: request.topic, channel: request.channel ?? null, packKey: pack?.key ?? null, packVersion: pack?.version ?? null, usedCredit: pre.usedCredit, createdByUserId: userId };
  const rows: Prisma.ContentDraftCreateManyInput[] = [];

  if (request.kind === "IDEA") {
    const ideas = result.ideas?.ideas.filter((i) => i.title.trim() && i.hook.trim()).slice(0, 5) ?? [];
    for (const [i, idea] of ideas.entries()) {
      const body = `${idea.hook}\n\n${idea.angle}\n\nFormato sugerido: ${idea.format}`;
      rows.push({ ...base, kind: "IDEA", title: idea.title.trim(), body, warnings: runChecks(pack, `${idea.title}\n${body}`), inputTokens: i === 0 ? result.usage.input : 0, outputTokens: i === 0 ? result.usage.output : 0 });
    }
  } else if (result.text?.body.trim()) {
    const signature = buildSignature(pack, pre.org);
    const text = result.text;
    const body = signature ? `${text.body.trim()}\n\n${signature.text}` : text.body.trim();
    // As verificações rodam no texto da IA (a assinatura é nossa e traz o nome do escritório).
    const warnings = [...runChecks(pack, `${text.title}\n${text.body}`), ...(signature?.warning ? [signature.warning] : [])];
    rows.push({
      ...base,
      kind: request.kind,
      title: text.title.trim(),
      body,
      sources: text.sources.filter((s) => /^https?:\/\//i.test(s.url) && !/(google|bing)\.[a-z.]+\/search/i.test(s.url)).slice(0, 8),
      toVerify: text.toVerify.slice(0, 10),
      warnings,
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
    });
  }

  if (rows.length === 0) {
    await refund();
    return { status: "error", message: "A IA não devolveu um texto válido. Tente reformular o assunto." };
  }
  await withOrgContext(organizationId, async (tx) => {
    // Troca a reserva pelos rascunhos reais, na mesma transação.
    await tx.contentDraft.deleteMany({ where: { organizationId, generationId, body: "" } });
    await tx.contentDraft.createMany({ data: rows });
  });
  return { status: "ok", generationId, count: rows.length };
}
