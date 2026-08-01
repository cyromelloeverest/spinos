// Dado semente real: primeiro tenant piloto (Sakatec) + oportunidades
// encontradas manualmente via pesquisa (concierge MVP), antes de qualquer
// pipeline automatizado de coleta de sinais.

export type Urgency = "alta" | "media" | "baixa";

export type Signal = {
  date: string; // granularidade de mês — não fabricamos precisão de dia que não temos
  category: string;
  text: string;
  sourceLabel: string;
  sourceUrl: string;
};

export type Opportunity = {
  id: string;
  name: string;
  city: string;
  state: string;
  distanceKm: number;
  score: number;
  urgency: Urgency;
  urgencyLabel: string;
  headline: string;
  execSummary: string;
  reasoning: string;
  buyerArea: string;
  decisionMaker: string;
  approach: string;
  arguments: string[];
  objections: string[];
  signals: Signal[];
};

export const organization = {
  name: "Sakatec",
  site: "https://sakatec.com.br",
  city: "Sumaré",
  state: "SP",
  segment: "Usinagem, metalização, caldeiraria e corte a laser",
};

export const icp = {
  segments: [
    "Indústria metalúrgica",
    "Fabricantes de equipamentos",
    "Autopeças e fornecedores automotivos",
    "Máquinas e implementos agrícolas",
    "Painéis e quadros elétricos industriais",
  ],
  radiusKm: 70,
  services: ["Usinagem", "Metalização", "Caldeiraria industrial", "Corte a laser"],
  decisionMakerTitles: [
    "Diretor Industrial",
    "Gerente de Manutenção",
    "Gerente de Engenharia",
    "Gerente de Compras/Suprimentos",
  ],
};

export const opportunities: Opportunity[] = [
  {
    id: "sany-campinas",
    name: "Sany do Brasil — nova fábrica",
    city: "Região de Campinas",
    state: "SP",
    distanceKm: 25,
    score: 94,
    urgency: "alta",
    urgencyLabel: "Alta · contatar agora",
    headline:
      "Construção de planta nova de máquinas pesadas — janela de homologação de fornecedores ainda aberta.",
    execSummary:
      "A Sany, fabricante chinesa de máquinas pesadas, confirmou nova fábrica na região de Campinas com início de operação ainda em 2026. Construção de planta industrial gera demanda imediata por caldeiraria (estruturas metálicas), usinagem de componentes e — por ser maquinário pesado exposto a intempérie — metalização como proteção anticorrosiva é argumento direto de venda para a Sakatec.",
    reasoning:
      "Obra de planta nova é o momento de maior probabilidade de compra: fornecedores ainda não estão homologados, e caldeiraria/usinagem/metalização são insumos de obra e de produção simultaneamente. Score alto por ser evento confirmado (não especulativo) e por casar com os quatro serviços da Sakatec ao mesmo tempo.",
    buyerArea: "Engenharia de instalações / Suprimentos da nova planta",
    decisionMaker: "Gerente de Engenharia ou Diretor Industrial da nova unidade",
    approach:
      "Contato agora, oferecendo capacidade local (Sumaré, ~25km) como vantagem logística frente a fornecedores de fora da região — antes que fechem a lista de fornecedores homologados da nova planta.",
    arguments: [
      "Fornecedor local reduz lead time durante a fase crítica de obra.",
      "Metalização é proteção anticorrosiva relevante para equipamentos de uso externo/pesado — argumento técnico direto.",
      "Capacidade em 4 serviços (usinagem, metalização, caldeiraria, corte a laser) reduz número de fornecedores que a Sany precisa gerenciar.",
    ],
    objections: [
      "\"Já temos fornecedores da matriz/China homologados.\" — Posicionar como fornecedor local complementar para itens urgentes e de reposição, não substituição total.",
      "\"Ainda estamos em fase de obra, sem processo de compras estruturado.\" — Alinhar contato com o cronograma da obra, oferecer orçamento sem compromisso agora.",
    ],
    signals: [
      {
        date: "2026",
        category: "Expansão",
        text: "Sany confirma nova fábrica na região de Campinas, com início de operação ainda em 2026 e geração de milhares de empregos.",
        sourceLabel: "Gazeta de São Paulo",
        sourceUrl:
          "https://www.gazetasp.com.br/economia/sany-confirma-nova-fabrica-na-regiao-de-campinas-com-geracao-de/",
      },
    ],
  },
  {
    id: "polo-automotivo-piracicaba",
    name: "Polo automotivo de Piracicaba (Hyundai + fornecedores)",
    city: "Piracicaba",
    state: "SP",
    distanceKm: 35,
    score: 72,
    urgency: "media",
    urgencyLabel: "Média · qualificar antes de abordar",
    headline:
      "Nova fábrica de motores da Hyundai (R$500M) deve elevar volume de produção dos 8 fornecedores coreanos já instalados ao redor.",
    execSummary:
      "A Hyundai investiu R$500 milhões em uma nova fábrica de motores em Piracicaba (2025/2026), reforçando um polo automotivo que já reúne 8 fornecedores diretos: Doowon, Hyundai Mobis, Hyundai Transys, Hwashin, Hyundai Steel, Myoung Shin, THN Auto e Seoyon E-hwa. Aumento de volume de produção tende a pressionar manutenção de ferramental e reposição de peças usinadas — mas como são fornecedores já estabelecidos (não abertura nova), a urgência é menor que a da Sany.",
    reasoning:
      "Sinal real de expansão de volume, não de abertura de conta nova — por isso o score é mais moderado. O valor aqui está em identificar qual desses 8 fornecedores terceiriza manutenção de ferramental/usinagem versus faz internamente, antes de gastar tempo comercial.",
    buyerArea: "Manutenção industrial / Ferramentaria",
    decisionMaker: "Gerente de Manutenção ou Engenharia de Processos",
    approach:
      "Mapear via LinkedIn/contato direto qual dos 8 fornecedores terceiriza usinagem de manutenção antes de prospectar — não abordar os 8 igualmente.",
    arguments: [
      "Aumento de volume de produção da fábrica-mãe historicamente eleva desgaste de ferramental nos fornecedores diretos.",
      "Fornecedor local de manutenção reduz parada de linha comparado a depender de peça vinda de fora do estado.",
    ],
    objections: [
      "\"Manutenção de ferramental é feita internamente.\" — Oferecer como capacidade extra em picos de demanda, não substituição da equipe interna.",
    ],
    signals: [
      {
        date: "2025-2026",
        category: "Expansão",
        text: "Hyundai investe R$500 milhões em nova fábrica de motores em Piracicaba, parte de mais de US$1 bilhão acumulado na região.",
        sourceLabel: "Portal do Município de Piracicaba",
        sourceUrl: "https://piracicaba.sp.gov.br/servicos/parque-automotivo/",
      },
      {
        date: "—",
        category: "Contexto",
        text: "8 empresas fornecedoras diretas instaladas ao redor da fábrica: Doowon, Hyundai Mobis, Hyundai Transys, Hwashin, Hyundai Steel, Myoung Shin, THN Auto e Seoyon E-hwa.",
        sourceLabel: "accio.com — Perfil Hyundai Motor Brasil Piracicaba",
        sourceUrl:
          "https://www.accio.com/supplier/pt/hyundai-motor-brasil-f%C3%A1brica-piracicaba",
      },
    ],
  },
  {
    id: "monter-itatiba",
    name: "Monter Elétrica",
    city: "Itatiba",
    state: "SP",
    distanceKm: 30,
    score: 65,
    urgency: "baixa",
    urgencyLabel: "Baixa · fit de conta recorrente",
    headline:
      "Fabricante de painéis elétricos desde 1995 — consumidora recorrente de chapa cortada e dobrada, não é um evento pontual.",
    execSummary:
      "A Monter fabrica quadros e painéis elétricos (QGBT) desde 1995 e atende todo o Brasil a partir de Itatiba. Gabinetes e painéis elétricos são feitos de chapa metálica cortada e dobrada sob medida — é o tipo de cliente que compra corte a laser como insumo semanal, não como reação a um evento de expansão.",
    reasoning:
      "Diferente das outras oportunidades da lista, este não é um sinal de \"momento\" — é um fit estrutural de ICP para o novo serviço de corte a laser. Score moderado porque não há urgência artificial a criar; o valor é a Sakatec entrar na concorrência de fornecimento recorrente.",
    buyerArea: "Compras / Produção",
    decisionMaker: "Gerente de Produção ou Compras",
    approach:
      "Abordagem de portfólio (capacidade + prazo + preço), não de urgência — pedir para entrar na lista de cotação recorrente de chapas cortadas.",
    arguments: [
      "Fornecedor local em Sumaré reduz frete e lead time comparado a fornecedores mais distantes.",
      "Sakatec oferece corte a laser + dobra + acabamento (metalização) num único fornecedor.",
    ],
    objections: [
      "\"Já temos fornecedor de corte a laser fixo.\" — Propor-se como segunda fonte para picos de demanda.",
    ],
    signals: [
      {
        date: "—",
        category: "Fit de ICP",
        text: "Fabricante de painéis elétricos (QGBT) desde 1995, atuando em todo o território nacional a partir de Itatiba/SP.",
        sourceLabel: "montereletrica.com.br",
        sourceUrl: "https://www.montereletrica.com.br/fabricantes-paineis-eletricos-sp",
      },
    ],
  },
  {
    id: "tgb-agro-itapira",
    name: "TGB Agro",
    city: "Itapira",
    state: "SP",
    distanceKm: 45,
    score: 60,
    urgency: "baixa",
    urgencyLabel: "Baixa · fit de conta recorrente",
    headline:
      "Fabricante de máquinas agrícolas com raiz declarada em metalurgia e usinagem de precisão.",
    execSummary:
      "A TGB Agro, sediada em Itapira, é fabricante de máquinas agrícolas com histórico próprio em metalurgia e usinagem de precisão. Estruturas e proteções de máquinas agrícolas são candidatas naturais a corte a laser terceirizado quando o volume não justifica capacidade própria adicional.",
    reasoning:
      "Assim como a Monter, é fit estrutural de ICP (fabricante que consome chapa cortada como insumo de produção), não um evento de expansão pontual — score reflete isso.",
    buyerArea: "Produção / Engenharia",
    decisionMaker: "Gerente de Produção ou Engenharia",
    approach:
      "Levar amostra técnica de corte a laser + prazo de entrega — decisão provavelmente é feita por comparação direta de capacidade e preço.",
    arguments: [
      "Empresa já entende o processo produtivo (raiz em metalurgia) — venda técnica, não educativa.",
      "Proximidade regional (45km) favorece entrega rápida em picos de demanda sazonal (safra).",
    ],
    objections: [
      "\"Fazemos corte internamente.\" — Posicionar como capacidade extra terceirizada para picos, não substituição.",
    ],
    signals: [
      {
        date: "—",
        category: "Fit de ICP",
        text: "Empresa fundada em 2018 em Itapira/SP com forte expertise em metalurgia e usinagem de precisão, hoje fabricante de máquinas agrícolas.",
        sourceLabel: "AgFeed",
        sourceUrl:
          "https://agfeed.com.br/negocios/sao-jose-industrial-chama-paulo-herrmann-para-expandir-fronteiras-para-seus-implemento-agricolas/",
      },
    ],
  },
  {
    id: "usina-pitangueiras",
    name: "Usina Pitangueiras",
    city: "Pitangueiras",
    state: "SP",
    distanceKm: 195,
    score: 40,
    urgency: "baixa",
    urgencyLabel: "Baixa · fora do raio operacional",
    headline:
      "Investimento de R$1 bilhão em nova planta de etanol de milho, biometano e captura de CO₂ — mas a ~195km de Sumaré.",
    execSummary:
      "A Usina Pitangueiras planeja investir cerca de R$1 bilhão em diversificação (etanol de milho, biometano, captura de CO₂), o que normalmente implica grande volume de caldeiraria e usinagem pesada. O sinal é forte, mas a distância (região de Ribeirão Preto) está muito além do raio operacional atual da Sakatec — mantido na lista só como \"observar\", não \"contatar\".",
    reasoning:
      "Score penalizado principalmente pela distância, não pela qualidade do sinal. Só sobe se a Sakatec decidir atender fora da região metropolitana de Campinas.",
    buyerArea: "Engenharia de projetos / Manutenção",
    decisionMaker: "Gerente de Engenharia ou Manutenção",
    approach:
      "Não priorizar agora. Reavaliar se a Sakatec expandir raio de atendimento ou abrir logística para o interior de SP mais distante.",
    arguments: [
      "Investimento de R$1 bilhão indica múltiplos ciclos de compra de caldeiraria/usinagem ao longo de vários anos, não um pico único.",
    ],
    objections: [
      "Distância de ~195km encarece frete e tempo de resposta a ponto de tornar a proposta pouco competitiva frente a fornecedores locais.",
    ],
    signals: [
      {
        date: "—",
        category: "Expansão",
        text: "Usina Pitangueiras planeja investir ~R$1 bilhão em etanol de milho, biometano e captura de CO₂ nos próximos anos.",
        sourceLabel: "Andra Virtual",
        sourceUrl:
          "https://andravirtual.com.br/negocios/45286/usina-pitangueiras-projeta-etanol-de-milho-e-investimento-de-r-1-bilhao",
      },
    ],
  },
];

export function getOpportunity(id: string) {
  return opportunities.find((o) => o.id === id);
}
