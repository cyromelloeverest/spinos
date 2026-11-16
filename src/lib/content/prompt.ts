import type { NichePack } from "@/packs/schema";
import type { ContentRequest } from "./schema";

type OrgInfo = { name: string; city: string | null; state: string | null; segment: string | null };

const KIND_SPEC: Record<string, string> = {
  SOCIAL_POST: "Legenda para rede social: 80 a 150 palavras, tom próximo e profissional, uma ideia só, convite discreto no final (ex.: chamar para conversar), no máximo 4 hashtags. Sem emojis em excesso.",
  ARTICLE: "Artigo curto para o blog do site: 500 a 700 palavras, com título, introdução, 3 a 4 intertítulos (linhas começando com '## ') e fecho. Estrutura útil para quem busca a resposta: responda a pergunta logo no começo.",
  EMAIL: "Texto de e-mail informativo: o campo title é o assunto (até 60 caracteres, sem exagero); corpo de 150 a 250 palavras, uma ideia só, um convite discreto no final. Não inclua rodapé de descadastro: o envio cuida disso.",
  IDEA: "Cinco ideias de conteúdo distintas entre si, cada uma com título, uma frase de abertura e o ângulo.",
};

// Instruções comuns a todo conteúdo: verdade primeiro. A IA escreve rascunhos; quem responde pelo texto é o profissional.
const TRUTH_RULES = [
  "Escreva em português do Brasil, em linguagem clara, sem jargão desnecessário.",
  "Isto é um RASCUNHO que um profissional vai revisar antes de usar. Nunca finja que o texto já foi aprovado.",
  "Nunca invente fatos, números, prazos, leis, casos de clientes, depoimentos ou estatísticas. Dado específico (data, valor, percentual, artigo de lei) só entra se você confirmou numa fonte oficial e real; nesse caso coloque a fonte em sources. Se não confirmou, escreva de forma geral ('consulte o prazo vigente') e liste o ponto em toVerify.",
  "Nunca use URL de página de resultado de busca como fonte.",
  "Não prometa resultado, não cite preço e não compare com outras empresas.",
];

export function buildContentPrompt(org: OrgInfo, pack: NichePack | null, request: ContentRequest): string {
  const place = [org.city, org.state].filter(Boolean).join("/");
  const rules = pack?.contentRules ?? [];
  const topics = request.kind === "IDEA" ? (pack?.contentTopics ?? []) : [];
  const channel = request.channel === "LINKEDIN" ? "LinkedIn (mais formal, voltado a donos de empresa)" : request.channel === "INSTAGRAM" ? "Instagram (mais direto e visual)" : null;
  return [
    `Você é redator(a) de conteúdo de marketing de "${org.name}"${org.segment ? `, atuando em ${org.segment}` : ""}${place ? `, em ${place}` : ""}.`,
    pack ? `Segmento: ${pack.name}.` : "",
    "",
    `PEDIDO: ${request.topic}`,
    channel ? `CANAL: ${channel}` : "",
    `FORMATO: ${KIND_SPEC[request.kind]}`,
    "",
    "REGRAS GERAIS:",
    ...TRUTH_RULES.map((r) => `- ${r}`),
    rules.length ? "\nREGRAS DO SEGMENTO (obrigatórias):" : "",
    ...rules.map((r) => `- ${r}`),
    topics.length ? `\nTEMAS QUE COSTUMAM FUNCIONAR NESTE SEGMENTO (use como inspiração, não copie):\n${topics.map((t) => `- ${t.title}: ${t.angle}`).join("\n")}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
