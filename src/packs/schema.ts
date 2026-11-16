import { z } from "zod";
import { CONFIG_SCHEMAS, type AutomationKey } from "@/lib/automations/recipes";

// Pacote de nicho: tudo que muda de um nicho para outro, como DADO validado. Entrar em
// um nicho novo é criar uma pasta em src/packs/<nicho>/ com um pack.json; nenhuma regra
// de nicho pode viver no código fora de src/packs (há um teste que falha o build se
// uma palavra de nicho aparecer fora daqui).

const ALLOWED_VARIABLES = ["nome", "empresa", "escritorio", "seu_nome"] as const;
const VARIABLE_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

export const MESSAGE_VARIABLES = ALLOWED_VARIABLES;

const message = z
  .object({
    key: z.string().min(1).max(60),
    title: z.string().min(1).max(100),
    channel: z.enum(["WHATSAPP", "LINKEDIN", "EMAIL"]),
    // Em que etapa a mensagem faz sentido (vazio = qualquer uma).
    stageKeys: z.array(z.string()).max(10).default([]),
    body: z.string().min(1).max(1500),
  })
  .superRefine((m, ctx) => {
    for (const match of m.body.matchAll(VARIABLE_RE)) {
      if (!(ALLOWED_VARIABLES as readonly string[]).includes(match[1])) {
        ctx.addIssue({ code: "custom", message: `Variável desconhecida {{${match[1]}}} na mensagem ${m.key}` });
      }
    }
  });

const automationEntry = z.object({ enabled: z.boolean(), config: z.unknown() });

export const NichePackSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    name: z.string().min(1),
    description: z.string().min(1),
    vocabulary: z.object({ account: z.string(), accountPlural: z.string(), lead: z.string() }),
    pipeline: z.object({
      name: z.string().min(1),
      stages: z
        .array(z.object({ key: z.string().regex(/^[A-Z0-9_]+$/), name: z.string().min(1), kind: z.enum(["OPEN", "WON", "LOST"]) }))
        .min(3)
        .max(12),
    }),
    icp: z.object({
      segments: z.array(z.string()).max(30),
      servicesSold: z.array(z.string()).max(30),
      productsSold: z.array(z.string()).max(30),
      keywords: z.array(z.string()).max(30),
      decisionMakerTitles: z.array(z.string()).max(30),
      employeeMin: z.number().int().nullable(),
      employeeMax: z.number().int().nullable(),
      saleModel: z.enum(["PONTUAL", "RECORRENTE"]).nullable(),
      preferredSignalCategories: z.array(z.string()).max(13),
      idealCustomerDescription: z.string().max(2000),
    }),
    // Orientação extra para a busca por IA deste nicho.
    searchGuidance: z.string().max(3000),
    signals: z.array(z.object({ key: z.string(), label: z.string(), description: z.string() })).max(30),
    automations: z.record(z.string(), automationEntry),
    messages: z.array(message).max(30),
    // Regras do que o conteúdo gerado pode e não pode dizer neste nicho.
    contentRules: z.array(z.string()).max(20),
    contentTopics: z.array(z.object({ title: z.string(), angle: z.string() })).max(40),
  })
  .superRefine((p, ctx) => {
    const keys = p.pipeline.stages.map((s) => s.key);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: "Etapas com chave repetida" });
    if (!p.pipeline.stages.some((s) => s.kind === "OPEN")) ctx.addIssue({ code: "custom", message: "O funil precisa de uma etapa aberta" });
    if (!p.pipeline.stages.some((s) => s.kind === "WON")) ctx.addIssue({ code: "custom", message: "O funil precisa de uma etapa de ganho" });
    if (!p.pipeline.stages.some((s) => s.kind === "LOST")) ctx.addIssue({ code: "custom", message: "O funil precisa de uma etapa de perda" });
    // As receitas de automação precisam existir e ter configuração válida; etapas citadas precisam existir.
    for (const [key, entry] of Object.entries(p.automations)) {
      const schema = (CONFIG_SCHEMAS as Record<string, z.ZodType>)[key];
      if (!schema) {
        ctx.addIssue({ code: "custom", message: `Automação desconhecida: ${key}` });
        continue;
      }
      const parsed = schema.safeParse(entry.config);
      if (!parsed.success) ctx.addIssue({ code: "custom", message: `Configuração inválida da automação ${key}: ${parsed.error.issues[0]?.message}` });
    }
    const stageRefs: string[] = [];
    const stageTasks = p.automations.stage_tasks?.config as { rules?: { stageKey: string }[] } | undefined;
    for (const r of stageTasks?.rules ?? []) stageRefs.push(r.stageKey);
    const follow = p.automations.proposal_followup?.config as { stageKeys?: string[] } | undefined;
    for (const k of follow?.stageKeys ?? []) stageRefs.push(k);
    for (const m of p.messages) for (const k of m.stageKeys) stageRefs.push(k);
    for (const ref of stageRefs) if (!keys.includes(ref)) ctx.addIssue({ code: "custom", message: `Etapa inexistente referenciada: ${ref}` });
  });

export type NichePack = z.infer<typeof NichePackSchema>;
export type PackAutomationKey = AutomationKey;
