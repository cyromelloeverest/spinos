export type Playbook = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  readMinutes: number;
  body: string[];
};

export const PLAYBOOKS: Playbook[] = [
  {
    slug: "abertura-sem-soar-script",
    title: "Como abrir uma ligação sem soar como script",
    summary: "A primeira frase decide se a pessoa do outro lado continua ouvindo ou desliga.",
    category: "Prospecção",
    readMinutes: 4,
    body: [
      "Ninguém gosta de sentir que está ouvindo um roteiro decorado. A primeira frase de uma abordagem — por telefone, WhatsApp ou e-mail — precisa provar em menos de 10 segundos que você fez a lição de casa sobre a empresa dela, não sobre empresas em geral.",
      "Em vez de \"Tudo bem? Vi que sua empresa pode se beneficiar da nossa solução\", use um gatilho específico: uma obra nova, uma contratação recente, uma expansão. \"Vi que vocês estão ampliando a planta em Piracicaba — isso costuma gerar uma pressão grande em [processo específico], é por aí que vocês estão passando agora?\"",
      "Repare na estrutura: fato específico + hipótese sobre a dor + pergunta aberta. Isso faz três coisas ao mesmo tempo — mostra que você pesquisou, testa se a hipótese está certa, e devolve a palavra pro cliente em vez de abrir com um discurso sobre você.",
      "Regra prática: se a sua abertura funcionaria igual para qualquer empresa do seu ICP, ela é genérica demais. Reescreva até que só funcione pra essa empresa específica.",
    ],
  },
  {
    slug: "primeiros-5-minutos",
    title: "O que perguntar nos primeiros 5 minutos de uma reunião",
    summary: "Quem pergunta primeiro controla a conversa — e aprende o suficiente pra não perder tempo depois.",
    category: "Descoberta",
    readMinutes: 5,
    body: [
      "O maior erro no início de uma reunião comercial é começar apresentando a empresa e o produto. Isso empurra o cliente pro modo passivo — ele ouve, sorri, e no fim diz \"vou analisar e te retorno\". Quem pergunta primeiro guia a conversa.",
      "Comece pela situação atual: \"Como vocês resolvem [o problema] hoje?\" Depois vá pro problema real: \"O que mais incomoda nesse processo hoje?\" Só então explore a implicação: \"Se isso continuar assim, o que acontece daqui a 6 meses?\" — é essa pergunta que faz o cliente sentir o custo de não agir, não a sua apresentação de slides.",
      "Uma pergunta que separa quem vende bem de quem só apresenta bem: \"Quem mais, além de você, é afetado por essa decisão?\" Isso revela o processo de decisão real antes de você gastar energia convencendo a pessoa errada.",
      "Anote as respostas literalmente — palavras exatas que o cliente usou pro problema dele. Você vai reusar essas mesmas palavras na proposta. Isso faz a proposta parecer escrita sob medida, porque foi.",
    ],
  },
  {
    slug: "usar-sinais-a-favor",
    title: "Como usar sinais pra parecer que você leu a mente do cliente",
    summary: "Contratação, expansão, mudança de liderança — cada sinal é uma porta de entrada específica.",
    category: "Prospecção",
    readMinutes: 4,
    body: [
      "Um sinal (uma vaga aberta, uma obra, uma troca de diretoria) não é só um gatilho pra iniciar contato — é uma pista sobre o que a empresa provavelmente está sentindo agora, mesmo que ela ainda não tenha formalizado isso como um problema.",
      "Contratação em massa geralmente significa que a estrutura atual não aguenta o volume — e isso quase sempre estressa processos ao redor da área que está contratando, não só a área em si. Uma nova fábrica ou expansão física sinaliza pressão em fornecedores, logística e capacidade operacional nos primeiros 6 a 12 meses.",
      "Troca de liderança é o sinal mais subestimado: gente nova no cargo costuma revisar fornecedores e processos nos primeiros 90 dias — é uma janela real, não um chute. Se você aborda nesse período com uma leitura certeira do que essa pessoa provavelmente está reavaliando, você vira uma opção óbvia, não mais um vendedor entre tantos.",
      "O objetivo não é citar o sinal como manchete (\"vi que vocês contrataram...\") — é usar o sinal pra formular a hipótese certa sobre a dor, e verificar essa hipótese com uma pergunta, não uma afirmação.",
    ],
  },
  {
    slug: "follow-up-sem-ser-chato",
    title: "Follow-up: a arte de não ser chato nem sumir",
    summary: "Entre o silêncio total e o \"só passando aqui pra saber se você viu meu e-mail\" tem um meio-termo.",
    category: "Fechamento",
    readMinutes: 4,
    body: [
      "A maioria dos vendedores desiste depois de 1 ou 2 tentativas sem resposta — mas a maior parte das vendas B2B fecha depois do 5º contato. O problema não é fazer follow-up, é fazer sempre o mesmo follow-up vazio (\"oi, tudo bem? Alguma novidade?\").",
      "Cada follow-up deveria trazer algo novo, por menor que seja: uma informação relevante pro setor dela, uma pergunta específica sobre algo que ela mencionou, ou uma atualização real da sua proposta. Isso transforma o follow-up de \"cobrança\" em \"continuação de conversa\".",
      "Um recurso simples e eficaz: o e-mail de \"vou fechar o processo\". Depois de 3-4 tentativas sem resposta, envie algo direto: \"Não quero encher sua caixa de entrada — vou pausar por aqui, mas fico à disposição se voltar a fazer sentido.\" Isso costuma gerar mais resposta que qualquer outro follow-up, porque tira a pressão e devolve o controle pro cliente.",
      "Regra de ouro: nunca faça o cliente se sentir culpado por não ter respondido. Isso fecha a porta. O tom certo é sempre leve, útil e sem cobrança.",
    ],
  },
  {
    slug: "nao-temos-orcamento",
    title: "Como lidar com \"não temos orçamento agora\"",
    summary: "Quase nunca é sobre dinheiro. É sobre prioridade — e prioridade se constrói com implicação clara.",
    category: "Objeções",
    readMinutes: 4,
    body: [
      "\"Não temos orçamento\" raramente significa que não existe dinheiro nenhum na empresa. Significa que, no ranking de prioridades dela, o seu problema ainda não subiu o suficiente pra competir por esse dinheiro. A resposta certa não é dar desconto — é reabrir a implicação do problema.",
      "Pergunte: \"Entendo. Se esse problema continuar do jeito que está pelos próximos 6 meses, qual o impacto disso em [receita / operação / risco]?\" Se a resposta mostrar um custo real de não agir, o orçamento tende a aparecer — porque agora tem uma justificativa concreta pra defender internamente.",
      "Se mesmo assim não houver orçamento neste ciclo, não force a venda — pergunte quando o próximo ciclo de orçamento abre, e o que precisaria estar pronto (proposta, aprovação interna, caso de negócio) pra essa decisão ser rápida quando chegar a hora. Isso te mantém no radar sem parecer insistente.",
      "Desconto imediato quando ouve \"sem orçamento\" ensina o cliente a sempre objetar preço primeiro — com você e com o próximo vendedor que aparecer. Evite esse padrão.",
    ],
  },
  {
    slug: "features-vs-valor",
    title: "Diferença entre features e valor — e por que isso fecha mais vendas",
    summary: "Ninguém compra uma lista de funcionalidades. Compram o resultado que essas funcionalidades entregam.",
    category: "Discurso comercial",
    readMinutes: 3,
    body: [
      "Feature é o que o seu produto ou serviço faz. Valor é o que muda na vida do cliente por causa disso. \"Fazemos corte a laser com tolerância de 0,1mm\" é uma feature. \"Isso significa que você não precisa retrabalhar peça nenhuma na linha de montagem\" é valor.",
      "O erro mais comum em apresentações comerciais é empilhar features (\"temos isso, temos aquilo, também fazemos isso\") esperando que o cliente faça sozinho a tradução pra valor. A maioria não faz — e sai da reunião achando que você é \"mais uma empresa que faz X\".",
      "Pra cada feature que você for mencionar, complete a frase: \"...o que significa que você...\". Se não conseguir completar com algo concreto e relevante pro que o cliente disse na descoberta, corte a feature da conversa. Ela não está ajudando a vender, só está ocupando tempo.",
      "O valor mais forte é sempre o que conecta direto com a dor que o próprio cliente descreveu com as palavras dele — não com as palavras do seu material de vendas.",
    ],
  },
  {
    slug: "identificar-decisor-real",
    title: "Como identificar o decisor real dentro da empresa",
    summary: "A pessoa mais simpática na reunião nem sempre é quem assina o contrato.",
    category: "Descoberta",
    readMinutes: 4,
    body: [
      "Em vendas B2B, é comum a primeira reunião ser com alguém operacional — que sente a dor mas não tem orçamento pra resolver sozinho. Vender bem pra essa pessoa e nunca chegar no decisor é uma das causas mais comuns de proposta que \"sumiu\".",
      "Pergunta direta funciona melhor do que parece arriscada: \"Além de você, quem mais precisa estar de acordo pra essa decisão avançar?\" A maioria das pessoas responde com sinceridade quando a pergunta é feita com curiosidade genuína, não com desconfiança.",
      "Sinais indiretos de que você não está falando com o decisor: a pessoa evita falar de prazo e orçamento com precisão, sempre precisa \"levar pra alguém\", ou fica visivelmente aliviada quando você propõe incluir mais alguém na próxima conversa.",
      "Quando identificar o decisor real, não pule a pessoa que te trouxe até ali — leve ela junto pra próxima conversa. Ela vira sua aliada interna, e isso costuma pesar mais do que qualquer argumento externo seu.",
    ],
  },
  {
    slug: "propostas-que-vendem-sozinhas",
    title: "Propostas que vendem sozinhas: estrutura de uma boa proposta comercial",
    summary: "Uma proposta boa devia fazer sentido mesmo pra quem não estava na reunião.",
    category: "Fechamento",
    readMinutes: 5,
    body: [
      "Muita proposta comercial é só uma lista de preços com uma capa bonita. O problema é que a proposta quase nunca é lida só pela pessoa que você conheceu — ela circula internamente, às vezes sem você por perto pra explicar o contexto. Se a proposta não se sustenta sozinha, ela perde força a cada pessoa nova que a lê.",
      "Estrutura que funciona: (1) o problema, nas palavras do próprio cliente — mostra que você entendeu antes de vender; (2) o custo de não resolver — a implicação que vocês discutiram na reunião; (3) a solução, conectada direto ao problema, não uma lista genérica de tudo que você oferece; (4) prova — case, número, ou referência; (5) próximo passo claro, com data.",
      "Evite propostas com múltiplos pacotes confusos (\"Bronze, Prata, Ouro\") quando você já sabe exatamente qual é a dor. Oferecer 3 opções genéricas transfere de volta pro cliente o trabalho de decidir o que ele precisa — trabalho que já devia ter sido feito por você na descoberta.",
      "Termine sempre com uma ação específica e uma data, não um \"fico à disposição\". \"Proponho fecharmos até dia 15 pra você já rodar a primeira fase antes do fim do trimestre\" move mais do que qualquer follow-up depois.",
    ],
  },
  {
    slug: "velocidade-de-resposta",
    title: "Por que velocidade de resposta é a arma mais subestimada em vendas B2B",
    summary: "Responder rápido não é sobre estar disponível 24h — é sobre ser a opção que menos exige espera.",
    category: "Prospecção",
    readMinutes: 3,
    body: [
      "Estudos de mercado (e a experiência de qualquer time comercial que mede isso) mostram a mesma coisa: as chances de qualificar um lead caem drasticamente depois dos primeiros minutos sem resposta, e continuam caindo hora a hora. Isso vale tanto pra quando o cliente te procura quanto pra quando você identifica uma oportunidade e é o primeiro a chegar.",
      "Velocidade não significa ser afobado — significa reduzir o tempo entre \"o sinal apareceu\" e \"o primeiro contato foi feito\" pro mínimo possível. Um lead que sente que a empresa está atenta e organizada já começa a conversa com mais confiança do que um lead abordado dias depois, quando o assunto já esfriou.",
      "Na prática: separe um horário fixo no dia só pra revisar oportunidades novas, em vez de deixar acumular. Menos é melhor quando é rápido do que mais quando é atrasado.",
      "Velocidade também importa depois da primeira resposta — em cada troca da negociação. Cliente que espera 3 dias por uma resposta sua começa a considerar outras opções nesse meio tempo, mesmo que goste de você.",
    ],
  },
  {
    slug: "transformar-nao-em-ainda-nao",
    title: "Como transformar um \"não\" em um \"ainda não\"",
    summary: "A maioria dos \"não\" são, na verdade, \"não agora\" ou \"não assim\" — e isso muda tudo.",
    category: "Objeções",
    readMinutes: 4,
    body: [
      "Quando um cliente diz \"não\", o instinto é desistir ou insistir no mesmo argumento com mais força. Nenhum dos dois costuma funcionar. O primeiro passo certo é entender qual \"não\" é esse — porque a maioria não é definitiva.",
      "Pergunta simples que separa os tipos de \"não\": \"Pra eu entender melhor — é um 'não' de agora não é prioridade, ou um 'não' de isso não resolve o que eu preciso?\" As respostas pedem abordagens completamente diferentes: a primeira é sobre timing, a segunda é sobre fit.",
      "Se for timing, não force — pergunte quando faria sentido retomar e marque um lembrete real, não um \"vou tentar de novo em um mês por conta própria\". Se for fit, pergunte especificamente o que faltou: \"O que precisaria ser diferente pra fazer sentido?\" A resposta é um mapa de como ajustar a proposta ou desqualificar de vez — os dois têm valor.",
      "Um \"não\" respeitado com elegância hoje é o que abre a porta pra um \"sim\" em 6 meses. Cliente lembra de quem insistiu de forma chata tanto quanto lembra de quem soube recuar direito.",
    ],
  },
];

export function getPlaybook(slug: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.slug === slug);
}
