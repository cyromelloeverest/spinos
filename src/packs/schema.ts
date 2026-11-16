import { z } from "zod";
import { CONFIG_SCHEMAS, type AutomationKey } from "@/lib/automations/recipes";
import { ICONS } from "@/lib/sites/content/sections";

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


// Modelo de site e páginas de captação do nicho. Os textos moram aqui (nunca no código) e usam
// as variáveis abaixo, preenchidas com o briefing do cliente quando o site é criado.
export const SITE_VARIABLES = ["negocio", "cidade", "responsavel", "registro"] as const;
// Responsável e registro profissional só podem aparecer no aviso do rodapé: são opcionais no briefing.
const SITE_FOOTER_ONLY_VARIABLES = ["responsavel", "registro"];

const siteItem = z.object({ title: z.string().min(1).max(80), description: z.string().max(400).optional(), icon: z.enum(ICONS).optional() });

const sitePage = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  // "" é a página inicial; as demais são um segmento em minúsculas.
  slug: z.string().regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(80),
  // Página de captação: cabeçalho enxuto (logo e botão), um único objetivo.
  landing: z.boolean().default(false),
  showInMenu: z.boolean().default(true),
  seoTitle: z.string().min(1).max(100),
  seoDescription: z.string().min(1).max(220),
  kind: z.enum(["page", "service", "about", "contact", "guide"]).optional(),
  hero: z.object({
    eyebrow: z.string().max(60).optional(),
    heading: z.string().min(1).max(160),
    highlight: z.string().max(80).optional(),
    subheading: z.string().max(480).optional(),
    badges: z.array(z.string().min(1).max(60)).max(4).default([]),
    ctaLabel: z.string().min(1).max(40),
  }),
  about: z.object({ heading: z.string().min(1).max(120), body: z.string().min(1).max(2000), highlights: z.array(z.string().min(1).max(80)).max(6).default([]) }).optional(),
  services: z.object({ heading: z.string().min(1).max(120), intro: z.string().max(400).optional(), items: z.array(siteItem).min(1).max(12) }).optional(),
  benefits: z.object({ heading: z.string().min(1).max(120), intro: z.string().max(400).optional(), items: z.array(siteItem).min(1).max(8) }).optional(),
  steps: z.object({ heading: z.string().min(1).max(120), intro: z.string().max(400).optional(), items: z.array(z.object({ title: z.string().min(1).max(80), description: z.string().max(400).optional() })).min(2).max(8) }).optional(),
  faq: z.object({ heading: z.string().min(1).max(120), items: z.array(z.object({ question: z.string().min(1).max(200), answer: z.string().min(1).max(1500) })).min(1).max(20) }).optional(),
  closing: z.object({ heading: z.string().min(1).max(120), body: z.string().max(300).optional(), ctaLabel: z.string().min(1).max(40) }).optional(),
  contact: z
    .object({
      heading: z.string().min(1).max(120),
      intro: z.string().max(600).optional(),
      submitLabel: z.string().max(40).optional(),
      messageLabel: z.string().max(60).optional(),
      messagePlaceholder: z.string().max(200).optional(),
    })
    .optional(),
});

export const siteTemplate = z
  .object({
    colors: z.object({ primary: z.string().regex(/^#[0-9a-fA-F]{6}$/), secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }),
    tagline: z.string().max(160).optional(),
    // Nichos regulados exigem identificar o responsável e o registro profissional no material de divulgação.
    requireRegistration: z.boolean().default(false),
    footerNotice: z.string().max(400).optional(),
    pages: z.array(sitePage).min(1).max(12),
  })
  .superRefine((t, ctx) => {
    if (!t.pages.some((p) => p.slug === "")) ctx.addIssue({ code: "custom", message: "O modelo de site precisa de uma página inicial" });
    const slugs = t.pages.map((p) => p.slug);
    if (new Set(slugs).size !== slugs.length) ctx.addIssue({ code: "custom", message: "Páginas do modelo de site com o mesmo endereço" });
    for (const p of t.pages) {
      if (p.hero.highlight && !p.hero.heading.includes(p.hero.highlight)) ctx.addIssue({ code: "custom", message: `O destaque precisa ser um trecho do título (${p.key})` });
    }
    const pagesText = JSON.stringify(t.pages);
    const everything = pagesText + (t.footerNotice ?? "") + (t.tagline ?? "");
    for (const m of everything.matchAll(VARIABLE_RE)) {
      if (!(SITE_VARIABLES as readonly string[]).includes(m[1])) ctx.addIssue({ code: "custom", message: `Variável desconhecida {{${m[1]}}} no modelo de site` });
    }
    for (const name of SITE_FOOTER_ONLY_VARIABLES) {
      if (new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`).test(pagesText + (t.tagline ?? ""))) ctx.addIssue({ code: "custom", message: `{{${name}}} só pode aparecer no aviso do rodapé` });
    }
    if (t.requireRegistration && !t.footerNotice) ctx.addIssue({ code: "custom", message: "Nicho que exige registro profissional precisa de um aviso no rodapé" });
  });

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
    // Verificações automáticas do texto gerado (expressões que o nicho não pode usar, ex.: preço,
    // promessa de resultado, comparação). Viram avisos no rascunho; a decisão é sempre da pessoa.
    contentChecks: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]+$/), pattern: z.string().min(1).max(500), message: z.string().min(1).max(300) })).max(30).default([]),
    // Assinatura obrigatória no material de divulgação (ex.: responsável e registro profissional).
    // Variáveis: {{negocio}}, {{responsavel}}, {{registro}}.
    contentSignature: z.string().max(300).optional(),
    // Modelo de site e de páginas de captação (opcional: nicho sem modelo usa o do pacote geral).
    site: siteTemplate.optional(),
  })
  .superRefine((p, ctx) => {
    for (const c of p.contentChecks) {
      try {
        new RegExp(c.pattern, "i");
      } catch {
        ctx.addIssue({ code: "custom", message: `Expressão inválida na verificação ${c.id}` });
      }
    }
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
