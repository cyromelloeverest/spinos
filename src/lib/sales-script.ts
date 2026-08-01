export type ScriptInput = {
  companyName: string;
  headline: string;
  execSummary: string;
  suggestedApproach: string;
  commercialArguments: string[];
  objections: string[];
  buyerArea: string | null;
  decisionMaker: string | null;
  contactName: string | null;
  recommendedOffering: string | null;
  orgName: string;
};

export function buildSalesScript(opp: ScriptInput): string {
  const saudacao = opp.contactName ? `Oi ${opp.contactName.split(" ")[0]}, tudo bem?` : "Oi, tudo bem?";
  const alvo = opp.decisionMaker || opp.buyerArea || "quem cuida disso na empresa";
  const oferta = opp.recommendedOffering ? ` com foco em ${opp.recommendedOffering.toLowerCase()}` : "";

  return `ABERTURA (ligação ou WhatsApp)
"${saudacao} Sou da ${opp.orgName}. Vi que ${stripTrailingPunctuation(lowerFirst(opp.headline))}. Por isso pensei em falar com vocês${oferta}. Faz sentido pra vocês agora?"

CONTEXTO PRA VOCÊ SABER ANTES DE LIGAR
${opp.execSummary}

MENSAGEM PRONTA (WhatsApp ou e-mail)
"Olá! Somos a ${opp.orgName}. ${opp.suggestedApproach} Podemos marcar uma conversa rápida essa semana?"

QUEM PROCURAR
${alvo}

ARGUMENTOS PRA USAR NA CONVERSA
${bulletList(opp.commercialArguments)}

SE ELE(A) HESITAR, PROVAVELMENTE VAI DIZER
${bulletList(opp.objections)}`;
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return text[0].toLowerCase() + text.slice(1);
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[\s.\-—–]+$/, "");
}

function bulletList(items: string[]): string {
  if (items.length === 0) return "- (nenhum registrado)";
  return items.map((item) => `- ${item}`).join("\n");
}
