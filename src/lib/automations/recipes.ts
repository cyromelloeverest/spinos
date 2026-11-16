import { z } from "zod";

// As 7 receitas prontas do funil (as mesmas do Everest CRM). Nenhuma envia e-mail a
// contato: só cria tarefas e distribui negociações dentro da equipe.
export type AutomationKey =
  | "lead_response"
  | "lead_distribution"
  | "stage_tasks"
  | "proposal_followup"
  | "no_next_step"
  | "won_onboarding"
  | "lost_reactivation";

const taskType = z.enum(["CALL", "WHATSAPP", "EMAIL", "LINKEDIN", "MEETING", "PROPOSAL", "TASK", "OTHER"]);
const taskSpec = z.object({ type: taskType, title: z.string().trim().min(1).max(150), days: z.number().int().min(0).max(365) });

export const CONFIG_SCHEMAS = {
  lead_response: z.object({ slaMinutes: z.number().int().min(5).max(24 * 60), escalateAfterMinutes: z.number().int().min(5).max(24 * 60) }),
  lead_distribution: z.object({ userIds: z.array(z.string()).max(50), cursor: z.number().int().min(0) }),
  stage_tasks: z.object({ rules: z.array(z.object({ stageKey: z.string().min(1), task: taskSpec })).max(20) }),
  proposal_followup: z.object({ stageKeys: z.array(z.string()).max(10), days: z.array(z.number().int().min(1).max(90)).max(6) }),
  no_next_step: z.object({ afterDays: z.number().int().min(1).max(60) }),
  won_onboarding: z.object({ tasks: z.array(taskSpec).max(8) }),
  lost_reactivation: z.object({ afterDays: z.number().int().min(7).max(365) }),
} as const;

export type AutomationConfig = { [K in AutomationKey]: z.infer<(typeof CONFIG_SCHEMAS)[K]> };

export const RECIPES: { key: AutomationKey; group: "Chegada do lead" | "Durante a negociação" | "Depois do fechamento"; title: string; description: string }[] = [
  { key: "lead_response", group: "Chegada do lead", title: "Lead sem resposta", description: "Venceu o prazo do primeiro atendimento e ninguém respondeu: cria uma tarefa para o responsável e, se continuar parado, para os gestores." },
  { key: "lead_distribution", group: "Chegada do lead", title: "Rodízio de leads", description: "Chegou um lead sem responsável: entrega para a próxima pessoa da fila, em rodízio." },
  { key: "stage_tasks", group: "Durante a negociação", title: "Tarefas por etapa", description: "Quando a negociação entra numa etapa, cria uma tarefa para o responsável no prazo escolhido." },
  { key: "proposal_followup", group: "Durante a negociação", title: "Follow-up de proposta", description: "Quando a negociação entra na etapa de proposta, agenda os follow-ups nos dias escolhidos." },
  { key: "no_next_step", group: "Durante a negociação", title: "Negociação sem próximo passo", description: "Negociação aberta sem nenhuma atividade agendada há alguns dias: cria uma tarefa para definir o próximo passo." },
  { key: "won_onboarding", group: "Depois do fechamento", title: "Venda fechada", description: "Quando a venda é ganha, cria as tarefas de boas-vindas e pós-venda." },
  { key: "lost_reactivation", group: "Depois do fechamento", title: "Retomar perdidos", description: "Quando a negociação é perdida, agenda uma tarefa para retomar o contato depois de um tempo." },
];

export function defaultConfig<K extends AutomationKey>(key: K): AutomationConfig[K] {
  const defaults: AutomationConfig = {
    lead_response: { slaMinutes: 30, escalateAfterMinutes: 30 },
    lead_distribution: { userIds: [], cursor: 0 },
    stage_tasks: { rules: [] },
    proposal_followup: { stageKeys: ["PROPOSTA_ENVIADA"], days: [2, 5, 10] },
    no_next_step: { afterDays: 2 },
    won_onboarding: {
      tasks: [
        { type: "CALL", title: "Boas-vindas ao cliente e passagem para a equipe", days: 1 },
        { type: "TASK", title: "Conferir o resultado com o cliente (30 dias)", days: 30 },
        { type: "TASK", title: "Pedir depoimento e indicação (90 dias)", days: 90 },
      ],
    },
    lost_reactivation: { afterDays: 90 },
  };
  return defaults[key];
}

// Lê a configuração salva; se faltar ou estiver inválida, volta ao padrão (uma
// configuração quebrada nunca pode derrubar uma automação nem o funil).
export function readConfig<K extends AutomationKey>(key: K, saved: unknown): AutomationConfig[K] {
  const parsed = CONFIG_SCHEMAS[key].safeParse(saved);
  return (parsed.success ? parsed.data : defaultConfig(key)) as AutomationConfig[K];
}

export function isAutomationKey(value: string): value is AutomationKey {
  return RECIPES.some((r) => r.key === value);
}
