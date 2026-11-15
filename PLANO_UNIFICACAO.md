# Plano de unificação da plataforma Spinos

Data: 2026-11-15. Status: **em aprovação. Decisões D1, D5 e D8 já tomadas. Única implementação feita: remoção do módulo Licitações.**

## Atualização de 2026-11-15 (respostas às decisões e pesquisas)

**Decisões tomadas por Cyro**

| # | Decisão | Efeito no plano |
|---|---|---|
| D1 | **Remover o módulo Licitações** | Código e migração de remoção prontos e commitados (`e2fd9d4`). Falta publicar e aplicar a migração. As 10 tabelas, o bucket e o log estavam vazios. Seção 8 fica sem pendência |
| D5 | **Investigar a base da Receita** | Aprovada. Primeiro passo da semana 1 |
| D8 | **Sem ambiente de testes** | Aceito. Hoje são 4 a 13 usuários. O risco R4 continua, com mitigação: flag por organização (WP0), migrações só aditivas, backup diário do Supabase Pro. WP0 cai para 2 a 3 dias |

**Pesquisas feitas**

1. **CNPJ alfanumérico.** A Receita começou a emitir CNPJ com letras e números em julho de 2026 ([notícia da Receita](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/julho/receita-federal-gera-o-primeiro-cnpj-em-formato-alfanumerico)). Isso afeta o modelo: `cnpj` deve ser texto de 14 caracteres alfanuméricos (sem validação "só dígitos"), e a extração de sócios pela BrasilAPI e a ingestão da base da Receita precisam aceitar o novo formato. O CRM hoje exige 14 dígitos. Entra em WP1 e WP4.
2. **Regras de publicidade do contador.** O código antigo (Resolução CFC 803/1996) foi substituído pela NBC PG 01, em vigor desde 01/06/2019. Pelas fontes secundárias que li, o marketing **não é proibido**, mas a divulgação deve ser informativa e discreta, sem mercantilização, sem propaganda de preço ou "menor preço" e sem falar mal de colegas. Conteúdo educativo e diagnóstico gratuito aparecem como formas aceitas. Fontes: [Jornal Contábil](https://www.jornalcontabil.com.br/conheca-as-regras-do-cfc-e-crc-e-divulgue-sua-marca-de-maneira-correta/), [CRC-MS](https://crcms.org.br/?p=24609), [CFC](https://cfc.org.br/noticias/codigo-de-etica-profissional-do-contador-e-atualizado-saiba-o-que-mudou/). **Não confirmei a numeração dos itens na norma vigente.** Consequência para o pacote: modelos de landing e mensagens sem preço, sem promessa de resultado e sem comparação com colegas, centrados em diagnóstico e conteúdo. O texto oficial da NBC PG 01 deve ser lido antes de fechar o pacote (WP2).
3. **Google Ads.** Ver a recomendação abaixo (seção 4.5).

**Google Ads: o que encaixa (substitui a recomendação da seção 4.5)**

- A busca mostrou que, em setembro de 2026, o nível de acesso passou a ser **do projeto no Google Cloud**, não mais do token de desenvolvedor ([Google Ads API, níveis de acesso](https://developers.google.com/google-ads/api/docs/access-levels)). O nível Basic permite até 15 mil operações por dia e a aprovação é automática; o Standard não tem tempo de análise publicado.
- **Não consegui confirmar** se, com um projeto nesse nível, o Spinos pode ler a conta de um cliente que **não** está ligada à nossa conta de gerente (MCC), só com o consentimento do dono da conta. Um tópico no fórum oficial pergunta exatamente isso e não tem resposta conclusiva. Isso precisa de teste real ou de resposta do time de conformidade do Google.
- O que o Pulse faz hoje (copiar o acesso da agência para todos os clientes) **não serve** para o produto: o acesso de um cliente enxergaria tudo da agência.
- **Recomendação:**
  1. **Camada 1: não usar a API do Google Ads.** O rastreio de origem até o contrato não precisa dela: a landing captura `gclid` e UTM, e o CRM mostra de qual anúncio veio cada contrato. Só o custo por lead exige o valor investido.
  2. **Investimento na camada 1:** campo manual ou importação de CSV por campanha. Simples e suficiente para os fundadores.
  3. **Camada 2:** cada escritório conecta a **própria** conta por consentimento (OAuth), usando um projeto Google Cloud do Spinos. Pedir o nível de acesso **na semana 4**, para a análise não travar a camada 2. Se o Google exigir vínculo por MCC, a alternativa é o cliente aceitar um convite de vínculo (fluxo mais pesado, mas permitido).
  4. **Alternativa para custo sem a API de anúncios:** puxar custo pelo GA4 quando a conta de anúncios estiver ligada a ele. Provável, **não confirmado**.

Como ler as estimativas: são "dias úteis de trabalho assistido por Claude, uma pessoa em tempo integral", com margem de erro de ±40%. Fato confirmado no código vem com o caminho do arquivo. Quando não consegui confirmar, está escrito "não confirmado".

---

## 0. Resumo executivo

**1. A unificação é viável, mas não do jeito "juntar os quatro códigos".** Os quatro sistemas têm bancos, logins e premissas de tenant diferentes (seção 1). O caminho que sobrevive é: o Spinos vira o núcleo (banco, login, tenant), e CRM, Pulse e Sites entram como módulos **portando o modelo e a lógica**, não copiando o código inteiro.

**2. O que mais pesa é o modelo de dados.** O Spinos de hoje não tem Contato, não tem Atividade, não tem Origem, não tem Campanha. O funil é um enum fixo de 5 etapas (inclusive "Visita agendada", que é conceito de venda de campo) e os tipos de sinal são outro enum fixo. O CRM tem tenant, funil, atividades, contratos e origem do lead, mas não tem a entidade Empresa. O Pulse não tem tenant nem lead individual. Resolver isso é o trabalho central da camada 1.

**3. Os 60 dias da camada 1 completa não são realistas para uma pessoa.** Somei os pacotes de trabalho: **67 a 89 dias úteis (cerca de 13 a 18 semanas)**. A camada 1 completa cabe em 90 a 120 dias corridos.

**4. A meta de 30 dias é possível só com uma versão mínima e escopo congelado.** Cortei um MVP de **cerca de 30 dias úteis** (seção 5.3) que dá para os 10 fundadores usarem e pagarem. A chance de escorregar de 1 a 2 semanas é real. O que o MVP entrega: prospecção por pacote de nicho de contabilidade, funil configurável, contatos por conta, uma landing page caindo no Spinos, origem do lead e um painel mínimo de resultados.

**5. Recomendei congelar o módulo Licitações; a decisão foi removê-lo.** Ele não ajudava a chegar nos próximos escritórios contábeis pagantes (seção 8).

**6. A tese tem uma contradição que o plano corrige.** A tabela de riscos diz que o cancelamento é contido por "relatórios mostrando leads e reuniões desde o primeiro mês", mas os relatórios estão na camada 2 (dias 61 a 120). O relatório de origem até o contrato **não precisa do Pulse**: sai dos dados do próprio CRM. Por isso entra um painel mínimo na camada 1 (pacote WP6). Os conectores do Pulse (Google Ads, Meta) entram na camada 2, para custo por lead e CAC.

**7. As decisões que dependem de você estão na seção 7** (são 9). As três que bloqueiam o início: congelar Licitações, aprovar o tempo de uma investigação sobre a base da Receita, e definir o ambiente de testes.

---

## 1. Inventário

### 1.1 Visão lado a lado

| | **Spinos** | **Everest CRM** | **Everest Pulse** | **Everest Sites** |
|---|---|---|---|---|
| Papel hoje | Inteligência comercial para clientes (SaaS, ao vivo) | CRM + e-mail marketing da agência e de um piloto | Relatórios e gestão da agência | Sites de clientes, multi-tenant por domínio |
| Stack | Next 16.3, Prisma 7.9, Supabase (Postgres + Auth), Stripe, Resend | Next 16.4, supabase-js direto, Supabase, SES, Resend | Next 16.3, supabase-js direto, Supabase, Claude SDK | Next 16.4, Drizzle, Postgres (Supabase), Better Auth, monorepo pnpm |
| Banco | Supabase `us-east-2`, plano **Pro**, backups diários | Supabase próprio, `sa-east-1` | Supabase próprio | Supabase próprio, Pro, `us-east-2` |
| Login | Supabase Auth, convite e cadastro | Supabase Auth (convite, Google), outro projeto | Supabase Auth, código de 6 dígitos, outro projeto | Better Auth (staff) + tabelas de login do cliente |
| Tenant | `organizations`, RLS **ativa e testada em uso** (`withOrgContext`) | `organizations`, RLS real, ~90 funções no banco, teste que exige RLS em toda tabela | **Não existe.** `clients` é a raiz. RLS ligada **sem nenhuma policy**; tudo roda com a chave de serviço | `tenant` + `tenant_id`, **sem RLS** (isolamento só no código e no papel de banco `sites_app`) |
| Testes | 20 arquivos de teste | ~320 casos (Postgres em memória) | **Nenhum, sem CI** | 21 arquivos, só nos pacotes; **nada na rota de lead** |
| Maturidade | Em produção, com clientes | Interno + piloto (5 semanas de vida: 08/10 a 09/11) | Em produção na agência (151 commits) | Em produção, 19 tenants, 21 sites (441 commits) |

### 1.2 Spinos (o que já existe)

- **Descoberta de empresas:** busca por IA com `web_search` (`src/lib/opportunity-engine/search.ts`) e coleta diária de sinais gratuitos (`src/lib/free-signals`): PNCP (pregão), Banco Central (instituições), RSS de notícias e BrasilAPI (sócios, via CNPJ). Roda por cron (`vercel.json`).
- **Pontuação:** `OpportunityScore` por organização × empresa × ICP, com nota, urgência, argumentos e abordagem sugerida.
- **Funil:** Kanban com 5 etapas fixas (`PipelineStage` em `prisma/schema.prisma`), sem funis configuráveis.
- **Outros:** assistente de vendas (roteiro determinístico), playbooks (10 artigos fixos), exportação, painel `/admin`, planos e Stripe (em modo teste), créditos, trial, LGPD (exportar e excluir dados), auditoria.
- **Módulo Licitações (beta, atrás de flag):** 10 tabelas, análise de edital por IA. Fora do escopo da unificação.
- **Fato central do modelo:**
  - `Company` é **global** e compartilhada entre clientes (fatos públicos), com CNPJ único.
  - Os dados do cliente ficam em `OpportunityScore`: contato (nome, telefone, e-mail) são colunas dessa tabela, e a etapa do funil também.
  - Não há entidade Contato, Atividade, Origem nem Campanha.

### 1.3 Everest CRM

Fonte: relatório de leitura do repositório `everest-crm` (79 commits, de 08/10 a 09/11/2026).

- **Completo e bom:** funil Kanban com ganho, perda com motivo, histórico de etapas e metas; leads com prazo de primeiro atendimento (SLA); atividades (ligar, WhatsApp, reunião, proposta) com próximo passo; contratos recorrentes (MRR) com alerta de reajuste; funil de conversão; extensão de Chrome para o WhatsApp Web (nunca envia mensagem); admin de organizações com sessão de suporte somente leitura e auditada.
- **E-mail marketing é o módulo mais maduro:** SES, descadastro de um clique, supressões, aprovação, limites, kill switch, snapshot do HTML enviado, retenção LGPD. Não confirmado que a conta SES saiu do sandbox nem que há campanhas reais.
- **Origem do lead:** `leads` guarda UTM (5), `gclid`, `fbclid`, campanha, página de entrada e `source_kind`; `lead_channels` classifica o canal por organização. **Não existe a entidade Campanha de mídia** (`mail_campaigns` é só e-mail).
- **Lacunas:** **não existe Empresa** (só o texto `contacts.company_name`); um contato por oportunidade; nenhuma automação além das embutidas; sem importador geral de leads; WhatsApp só por link `wa.me`; um funil efetivo por organização.
- **Premissas de agência no código:** plano "Ascensão" semeado em toda organização, marca Everest em textos e e-mails, remetente `crm.agenciaeverest.com.br`, canais fixos (Google, Meta, Network), funil padrão de 7 etapas, exigência de CNPJ de 14 dígitos.
- **Dívida documentada** (`docs/audits/AUD-2026-01`, ainda não versionada): desenvolvimento rodava contra o banco de produção (a guarda existe, mas não confirmei se há projeto de desenvolvimento separado), backup não verificado, vendedor altera negócio de colega (decisão pendente).

### 1.4 Everest Pulse

Fonte: relatório de leitura do repositório `everest-pulse` (151 commits, ~25 mil linhas, 37 migrações SQL rodadas à mão).

- **Completo:** relatório mensal (tela, PDF pelo navegador, e-mail com trava de duplicidade); conectores de Google Ads, GA4, Search Console, Meta Ads, RD Station, YouTube, LinkedIn e Instagram; funil comercial importado de planilha; metas; copiloto de IA com 8 ferramentas de leitura; monitor de site; concorrentes; horas.
- **O que o Pulse NÃO tem:** tenant, lead individual, contato, oportunidade, contrato. A origem do lead é **contagem agregada por canal**. Não dá para ligar clique → lead → contrato. Métricas de mídia **não são gravadas** (ficam em cache de 15 min a 1 h).
- **Segurança:** RLS ligada sem policies. O isolamento entre clientes é só código, espalhado em cada rota (sem camada central). O resumo da IA entra cru no HTML do e-mail.
- **Credenciais:** um único acesso do Google Ads e da Meta da agência é copiado para todos os clientes (`bulk-link.ts`). Num SaaS cada organização precisa do seu próprio acesso.
- **Atenção:** dados de demonstração (mock) são devolvidos quando uma integração falha, e há valores fixos da agência (`slug "everest"` em ~20 rotas, modelo de IA fixo, menu "Agência").
- A extensão de Chrome do Pulse (cronômetro) está **órfã**: o backend foi removido.

### 1.5 Everest Sites

Fonte: relatório de leitura do monorepo `everest-sites` (441 commits, 19 tenants, 21 sites).

- **A arquitetura é a mais próxima do que o Spinos precisa:** um único deploy serve N domínios, o tenant sai do cabeçalho `Host` e o app público roda com papel de banco de mínimo privilégio (`sites_app`).
- **Conteúdo como dado:** cada site é um documento JSON validado por zod (`packages/content`): 29 tipos de seção com variantes, tema, SEO e GEO (JSON-LD, `llms.txt`, sitemap), rascunho, publicação imutável e reversão.
- **Pipeline de lead pronto:** honeypot, limite por IP, fila de entrega com retry, webhook para o CRM com consentimento LGPD, captura de `gclid`, `fbclid`, `fbp`, analytics sem cookie. A integração com o Everest CRM **existe e está implementada**.
- **Criação programática de site:** `importSite()` + `starterContent()` + `attachDomain()` já existem. Falta uma função que gere a landing a partir de um modelo e dados (empresa, segmento, cidade, oferta).
- **Atrapalha:** `templateKey` é só um rótulo, não existe entidade de template; o conteúdo dos 19 clientes está em ~11.400 linhas de seeds, e os estilos de tema são ligados a clientes; 338 MB de mídia **dentro do repositório**; cada domínio novo exige uma chamada à API da Vercel; UTM só é capturada se ainda estiver na URL da página do formulário (não é guardada entre páginas, só o click ID).
- Nenhum site atual é landing page de campanha pura: são sites institucionais. Landing existe como página `landing: true` dentro de sites.

### 1.6 Fora do escopo

`everest-office` (escritório virtual, PixiJS + voz) não tem relação funcional com os módulos e não é candidato. `agenciaeverest` e `spinos-site` são sites de marketing.

---

## 2. Lacunas para a camada 1 (com ABM leve) e o que reaproveitar

### 2.1 Lacunas

| # | Lacuna | Onde está hoje | Gravidade |
|---|---|---|---|
| L1 | **Empresa por cliente (Conta)** separada do cadastro global e do Contato | Spinos: contato dentro de `OpportunityScore`. CRM: só `company_name` | Alta |
| L2 | **Contato** com vários por conta, papel de decisor, base legal e consentimento | CRM tem contato simples; Spinos não tem | Alta |
| L3 | **Funil e etapas como dado** (por pacote de nicho e por organização) | Spinos: enum fixo. CRM: dado, mas um funil por organização | Alta |
| L4 | **Sinais como dado** (catálogo por nicho) | Spinos: enum `SignalCategory` fixo | Alta |
| L5 | **Pacote de nicho** (configuração, instalação, versão) | Não existe em nenhum | Alta |
| L6 | **Fonte de dados para os sinais de contabilidade** (empresa recém-aberta, mudança de porte, saída do Simples, reforma tributária) | Spinos tem RSS, PNCP, BCB, BrasilAPI. **Não tem a base de CNPJ da Receita** | Alta, maior incerteza |
| L7 | **Origem e Campanha** como entidades, com toques (primeiro e demais) | CRM tem campos de origem no lead; Pulse só agregado | Média |
| L8 | **Landing por conta ou segmento** a partir de modelos do pacote | Sites tem peças, falta o gerador e o modelo | Média |
| L9 | **Lead de formulário caindo na conta certa** (criar ou mesclar conta e contato) | CRM recebe e marca duplicata, sem mesclar | Média |
| L10 | **Resultados de ponta a ponta** (origem → reunião → contrato) | CRM tem `contracts` e funil; falta cruzar com a origem | Média |
| L11 | **Autoatendimento em 7 dias** (assistente de configuração) | Spinos tem onboarding de empresa e ICP, nada de pacote, funil, domínio, importação | Média |
| L12 | **Ambiente de testes (staging)** | Spinos testa no domínio ao vivo (decisão registrada); CRM já teve o mesmo problema | Média |
| L13 | **Planos da tese** (R$ 497/997/1.997, setup R$ 1.500, preço de fundador travado) | `plans.ts` tem R$ 309/649/1.699, Stripe em modo teste | Média |
| L14 | Testes de RLS em todas as tabelas, em todo o Spinos | CRM tem; Spinos não tem um teste que exija RLS em toda tabela | Média |

### 2.2 O que reaproveitar de cada um

| Sistema | Reaproveitar | Como | Não reaproveitar |
|---|---|---|---|
| **CRM** | Modelo de funil, etapas ganho/perda, motivos de perda, atividades, contratos/MRR, metas, SLA, padrão de convite, sessão de suporte, retenção LGPD, harness de teste de RLS, extensão de WhatsApp | **Portar o modelo e a lógica** para o Spinos (o CRM usa RLS pelo login do usuário e ~90 funções SQL; o Spinos usa contexto de organização no app. São dois padrões incompatíveis, escolher um: o do Spinos) | Marca, plano "Ascensão", canais fixos, auth separada |
| **CRM (e-mail)** | Módulo de e-mail marketing inteiro | **Camada 3.** Continua no CRM até lá | — |
| **Pulse** | Conectores (Google Ads, GA4, Meta...), criptografia e renovação de token, relatório mensal, parser de funil de planilha | **Camada 2.** Reescrever o acesso a dados já com tenant e grant por organização | Isolamento sem RLS, token da agência copiado, mock, valores fixos da Everest |
| **Sites** | `packages/content` e `packages/sections` (schema, 29 seções, renderização), captura de atribuição, anti-spam, outbox de lead, SEO/GEO, `importSite`, proxy por Host | Incorporar como pacotes do Spinos; ver estratégia na seção 4 | Seeds por cliente, estilos presos a cliente, mídia dentro do repo |
| **Spinos** | Núcleo: tenant, RLS, créditos, trial, Stripe, convites, auditoria, busca por IA, sinais gratuitos, regras de honestidade da IA (campos que podem ser "não confirmado") | Manter e evoluir | Enums de funil e sinal, contato dentro de `OpportunityScore` |

---

## 3. Arquitetura proposta

### 3.1 Princípios

1. **Um banco, um login, um tenant.** O banco do Spinos é o núcleo. O tenant é `Organization`. Todo dado de cliente tem `organizationId` e RLS.
2. **Dois níveis de dado:** dados **globais** (fatos públicos sobre empresas, catálogos de pacote) e dados **do tenant** (tudo que o cliente cria ou que é inferência sobre ele).
3. **Nenhuma regra de nicho no código.** Tudo que muda de um nicho para outro vive no pacote. Critério de aceite verificável: nenhum arquivo em `src/` fora de `packs/` pode conter a palavra "contábil", "contabilidade" ou "escritório" (teste automático que falha o build).
4. **Registro único de Conta e Contato**, usado por todos os módulos. Lead não é uma tabela à parte: é uma Conta (ou Contato) em estado inicial, mais um registro da Entrada que a criou.
5. **Padrão de isolamento único:** o do Spinos (`withOrgContext` + papel de banco sem bypass) e as chaves estrangeiras compostas `(id, organizationId)` que já usamos no módulo de Licitações e que o CRM também adotou.
6. **Aditivo primeiro:** migrações só acrescentam até a fase de limpeza (seção 4).

### 3.2 Modelo de dados unificado

```
GLOBAL (sem tenant, fatos públicos)
  Company              cnpj único, nome, CNAE principal, porte, regime (quando conhecido),
                       data de abertura, município/UF, situação, site; origem do dado
  Signal               já existe; passa a usar signalTypeKey (texto) em vez do enum
  NichePack            id, versão, conteúdo validado (JSON + zod)

TENANT (organizationId + RLS em todas)
  Organization         já existe; ganha timezone, moeda, idioma
  OrganizationPack     qual pacote e versão está instalado + personalizações da organização

  Account (Conta)      organizationId, companyId?  (liga ao cadastro global quando há CNPJ),
                       nome, cnpj?, cidade/UF, estado (alvo | em contato | cliente | perdida),
                       responsável, origem inicial, campos livres (jsonb)
  AccountScore         nota por conta e ICP: perfil + sinais, justificativa, prioridade
                       (substitui o papel de pontuação do OpportunityScore)
  Contact (Contato)    accountId?, nome, cargo, papel (decisor, influenciador, usuário),
                       e-mail, telefone (E.164), base legal, consentimento, descadastro
  Opportunity          accountId, contato principal, funil e etapa, valores previsto e ganho,
                       status, motivo de perda, origem, canal, próximo passo, primeira resposta
  OpportunityContact   (opcional agora, preparado) vários decisores por oportunidade
  Pipeline / Stage     por organização; instalados a partir do pacote; etapas têm tipo
                       (aberta | ganha | perdida) e nome livre
  Activity             tipo (ligar, WhatsApp, e-mail, reunião, proposta, tarefa), conta, contato,
                       oportunidade, vencimento, resultado, cadencia?  (preparado, não usado)
  Origin (Origem)      um registro de "toque": tipo (prospecção | landing page | anúncio |
                       indicação | manual | importação), canal, campanha?, página?, utm_*, click ids,
                       quando. Conta/oportunidade guardam o PRIMEIRO toque; todos ficam gravados.
  Campaign             tipo (anúncio | e-mail | prospecção | evento), canal, nome, referência externa,
                       investimento (opcional)
  Inquiry (Entrada)    registro imutável de um formulário recebido; liga a conta e contato criados
                       ou mesclados, com a origem
  Contract             conta, oportunidade, valor, recorrente?, início  (mínimo para fechar
                       o rastreio até o contrato)
  LandingPage          organizationId, conta?, segmento?, modelo, documento (JSON), domínio, estado
  Consent / DataEvent  base legal, evidência, descadastro, anonimização, exportação
```

**Preparado para o ABM completo, sem construir agora:** `OpportunityContact` (vários decisores), `Activity.cadence` (cadência multicanal), `Account` com campos livres, `Origin`/`Campaign` com canal para públicos de anúncio e engajamento consolidado por conta. Nenhuma dessas colunas bloqueia o que vem depois.

**Regras de isolamento no banco:**
- RLS `tenant_isolation` em toda tabela do tenant, como já fazemos.
- Chave estrangeira composta `(accountId, organizationId)` etc., para o filho nunca apontar para o pai de outra organização.
- Teste automático (a ser portado do CRM, `tests/db/tenancy.test.ts`) que **falha se qualquer tabela do tenant não tiver RLS**. Hoje o Spinos não tem esse teste (lacuna L14).

**Como o dado atual migra:** `OpportunityScore` vira `Account` (+ `AccountScore`) e, quando a etapa não é nula, também uma `Opportunity`. Os campos de contato viram um `Contact`. O `Feedback` vira motivo de perda ou atividade. São 9 organizações hoje, então a migração é pequena e pode ser conferida à mão (seção 4).

### 3.3 Pacote de nicho

**O que é:** um pacote versionado e validado por zod (`packs/<nicho>/pack.json`), guardado no repositório. Na instalação, o conteúdo é **copiado** para a organização (para edições do cliente não quebrarem quando a plataforma atualizar o pacote); atualizações de versão são aplicadas por migração controlada.

**O que o pacote define (tudo como dado):**

| Bloco | Conteúdo | Exemplo para contabilidade |
|---|---|---|
| Prospecção | Filtros: CNAE, porte, regime, regiões, idade da empresa | Empresas abertas nos últimos 90 dias; CNAE de serviços e comércio com porte ME/EPP; sem contador identificado (quando houver dado) |
| Sinais | Catálogo (chave, nome, fonte, peso, regra de detecção) | Empresa recém-aberta; mudança de porte; saída do Simples; exposição à reforma tributária (regra por CNAE/regime/porte) |
| Pontuação | Pesos de perfil e de cada sinal; faixas de prioridade | Recém-aberta pesa mais que mudança de porte |
| Funil | Etapas, tipos, motivos de perda, metas por degrau | Novo → Diagnóstico → Proposta → Cliente; motivos de perda |
| Mensagens e atividades | Roteiros de abordagem, mensagens de WhatsApp com variáveis, tarefas sugeridas | "Vi que sua empresa abriu em ..." |
| Landing pages | Modelos como documentos do Sites, com campos a preencher | Abertura de empresa; Imposto de Renda; troca de contador |
| E-mail | Modelos (usado na camada 3) | Prazos fiscais, IR, reforma tributária |
| Resultados | Métricas e rótulos do painel | Leads, diagnósticos, propostas, contratos por origem |
| Vocabulário | Rótulos de tela por nicho | Conta = "empresa-alvo" |

**Entrar em nicho novo = criar uma pasta e um arquivo**, validado pelo zod, sem tocar no código. O teste de aceite da seção 3.1 (nenhuma palavra de nicho fora de `packs/`) garante que isso continue verdade.

**Itens do código atual que hoje violam isso e precisam sair:** o enum de funil, o enum de categorias de sinal, o prompt da busca por IA (`buildSearchPrompt`), os 10 playbooks fixos, o roteiro determinístico de abordagem e rótulos em `src/lib`.

### 3.4 Dados para os sinais de contabilidade (L6)

Os sinais pedidos no briefing (empresa recém-aberta, mudança de porte, saída do Simples) só saem de forma confiável da **base aberta de CNPJ da Receita Federal**, que o Spinos hoje não usa. O que consegui confirmar na pesquisa:

- Existe conjunto oficial de dados abertos do CNPJ, em arquivos CSV (separador `;`, codificação ISO-8859-1), divididos em tabelas de Empresas, Estabelecimentos e Sócios, entre outras. Referência: [dados.gov.br, Cadastro Nacional da Pessoa Jurídica](https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj).
- As fontes que encontrei **discordam sobre a frequência** de atualização (mensal em duas, trimestral em uma de qualidade menor). **Não confirmado.**
- **Não consegui confirmar** os nomes exatos das colunas de data de início de atividade e de opção/exclusão do Simples. O documento oficial de layout (PDF no repositório da Receita) precisa ser lido antes de qualquer promessa.
- A mudança de layout entre versões já quebrou ferramentas de terceiros (relato em projeto aberto). Precisa de ingestão defensiva e alerta.

**Proposta:** uma investigação de **3 dias úteis** (WP4a) antes de comprometer o cronograma: baixar um mês, medir tamanho e tempo de carga, ler o layout oficial, e provar que os três sinais saem dos dados. Só então se decide a ingestão. A carga deve filtrar por UF e CNAE (não carregar a base inteira) e gravar só o que alimenta sinais.

**Mudança de porte e saída do Simples exigem comparar duas versões do arquivo** (antes e depois). Isso só funciona se guardarmos o histórico mês a mês. Para o MVP, o sinal mais seguro e simples é **empresa recém-aberta**; os outros dois entram depois da investigação.

### 3.5 Login e identidade

- **Um login:** o Supabase Auth do Spinos (projeto atual). Os outros projetos (CRM, Pulse, Sites) mantêm o login próprio enquanto rodam em paralelo.
- **Usuários antigos:** serão **reconvidos** por e-mail para o Spinos, sem migrar senha. Não encontrei no código dos outros sistemas uma forma segura e simples de exportar credenciais entre projetos Supabase, e mover hashes não é uma boa ideia.
- **A agência vira uma organização** no Spinos ("Agência Everest"), com o papel de administração da plataforma (`isSuperAdmin`, já existe) para a equipe Everest.
- O "Everest ID" (SSO) do CRM (`docs/EVEREST-ID.md`) fica **cancelado** por esta proposta: é a solução para ter 4 logins, e o plano é ter 1.

### 3.6 Módulos e como entram

```
Spinos (núcleo, banco único)
  ├── Prospecção + ABM leve (já existe; ganha pacote, contas, sinais por dado)
  ├── CRM        (portado do Everest CRM: funil, atividades, contatos, contratos)
  ├── Landing pages (Sites: pacotes content/sections + gerador + modelos do pacote)
  ├── Resultados    (camada 1: origem → contrato; camada 2: + conectores do Pulse)
  └── E-mail e conteúdo (camada 3: módulo de e-mail do CRM)
```

---

## 4. Estratégia de migração (sem quebrar o que roda hoje)

### 4.1 Regra geral

**Estrangular, não substituir.** Os sistemas atuais continuam rodando para os clientes da agência até a camada 2 estar estável, como você pediu. Nada do que está em produção é desligado ou alterado durante a camada 1.

### 4.2 Spinos (expandir → copiar → trocar → limpar)

1. **Expandir:** criar as tabelas novas (Conta, Contato, Oportunidade, Atividade, Origem, Campanha, Funil, Etapa, Pacote), só acrescentando. Nenhuma coluna ou tabela atual é removida nesta fase.
2. **Copiar:** script que gera Conta, Contato e Oportunidade a partir de `OpportunityScore`, conferido organização por organização (são 9). Os dois lados coexistem.
3. **Trocar:** a interface passa a ler do modelo novo atrás de uma flag por organização. A organização da agência vai primeiro.
4. **Limpar:** só depois de 30 dias estáveis, remover as colunas e enums antigos (migração à parte, com sua aprovação).

**Reversão:** em qualquer ponto até o passo 4, a flag volta e o modelo antigo continua inteiro. Os backups diários do Supabase Pro cobrem o banco (não cobrem os arquivos do Storage, ver riscos).

### 4.3 CRM

- A camada 1 **constrói o CRM dentro do Spinos** a partir do modelo e da lógica do CRM. O Everest CRM continua em produção.
- Migração dos **dados da própria agência** (contatos, leads, oportunidades, atividades, contratos) por script, para a organização "Agência Everest" no Spinos. Dedup: o CRM só tem o texto `company_name`; agrupar por nome normalizado gera uma fila de revisão manual (não há CNPJ para casar).
- **O módulo de e-mail marketing fica no CRM antigo até a camada 3.** Isso significa que, na camada 1, o Spinos não envia e-mail em massa. O "follow-up automático" da tese entra na camada 1 como **tarefas e lembretes** (atividades com vencimento), não como disparo.
- **Critério para desligar o CRM antigo:** todos os clientes ativos migrados, o módulo de e-mail portado e estável por 30 dias, e a extensão do WhatsApp apontando para o Spinos.

### 4.4 Sites

Há uma decisão que depende de você (D3). Minha recomendação:

- **Fase A (camada 1, ponte transitória):** o Spinos gera o documento da landing page usando o pacote `content`, chama a criação de site do Sites por uma rota interna autenticada, e recebe o lead por um endpoint novo (`/api/v1/inbound`, mesmo contrato do webhook que o CRM já usa). Cada organização do Spinos guarda a ligação com o tenant do Sites. Isso é **dívida declarada**, com data para acabar.
- **Fase B (a partir da camada 2):** as tabelas de site passam para o banco do Spinos, o renderizador público continua um deploy separado lendo o banco do Spinos com um papel restrito (como já funciona hoje), e os 19 tenants atuais migram quando houver janela. O renderizador **não precisa entrar no mesmo app** do Spinos: a unificação que importa é a de dados e de conta.
- **Antes de usar o gerador em escala:** tirar as imagens do repositório (338 MB) para armazenamento próprio, e transformar os estilos presos a clientes em temas parametrizados.

### 4.5 Pulse (camada 2)

- Reescrever o acesso aos dados com tenant e RLS desde o início, não portar o painel como está.
- Um acesso por organização (OAuth próprio) em vez do token da agência copiado. **Risco:** o Google Ads exige credencial de desenvolvedor aprovada para acesso multi-conta. O PDF de aprovação do Pulse (`docs/`) é de uso para agência; precisa de revisão para uso por clientes (não confirmado, ver riscos).
- Persistir métricas diárias (hoje não são gravadas): é o que permite histórico e atribuição.
- Manter o Pulse atual para a agência até a camada 2 estar estável.

### 4.6 Portões de decisão (cada camada só começa quando o portão fecha)

| Portão | Condição |
|---|---|
| Fim do MVP (dia 30) | 10 fundadores pagando (já na tese). 5 a 9: ajusta oferta e preço. Abaixo de 5: revê o nicho |
| Camada 1 → 2 | Fundadores usando a camada 1 toda semana, sem incidente grave aberto, e a migração do modelo antigo concluída |
| Camada 2 → 3 | Relatórios de origem até contrato em uso real e cancelamento mensal medido |
| Desligar sistemas antigos | Critérios por sistema (seção 4.3) |

---

## 5. Plano da camada 1

### 5.1 Pacotes de trabalho

| Pacote | O que entrega | Dias úteis | Depende de |
|---|---|---|---|
| WP0 | **Fundamentos:** ambiente de testes, teste que exige RLS em toda tabela, flags por organização, política de migração | 3 a 4 | — |
| WP1 | **Modelo unificado:** Conta, Contato, Oportunidade, Atividade, Origem, Campanha, Funil/Etapa + RLS + testes + cópia dos dados atuais | 8 a 10 | WP0 |
| WP2 | **Pacote de nicho:** esquema, instalação, versionamento, pacote de contabilidade v1; troca dos enums fixos por dados; teste de "nenhuma palavra de nicho fora de `packs/`" | 8 a 10 | WP1 |
| WP3 | **CRM no Spinos:** Kanban com etapas dinâmicas, ficha da conta com contatos, atividades e tarefas, ganho e perda, contrato mínimo, importação de leads por CSV | 10 a 12 | WP1, WP2 |
| WP4a | **Investigação da base de CNPJ da Receita** (seção 3.4) | 3 | — |
| WP4b | **Prospecção por pacote:** lista de contas-alvo, pontuação, sinais por dado, ingestão da Receita (conforme resultado do WP4a), busca por IA parametrizada pelo pacote | 10 a 15 | WP2, WP4a |
| WP5 | **Landing pages:** gerador a partir de modelo do pacote, 3 modelos (abertura de empresa, IR, troca de contador), endpoint de entrada, ponte com o Sites, página por conta ou segmento | 8 a 12 | WP2 |
| WP6 | **Origem ponta a ponta + painel mínimo de Resultados:** toque de origem em toda entrada, relatório por origem até contrato | 4 a 6 | WP1, WP3, WP5 |
| WP7 | **Autoatendimento em 7 dias:** assistente de configuração (empresa, pacote, ICP, funil, importação, domínio), planos novos, Stripe em modo real, preço de fundador travado | 6 a 8 | WP2 |
| WP8 | **LGPD:** base legal por registro, descadastro, retenção, documento de teste de legítimo interesse, revisão dos termos | 3 a 4 (+ advogado) | WP1 |
| WP9 | **Endurecimento:** testes de ponta a ponta, migração das organizações existentes, correções | 4 a 5 | tudo |
| | **Total** | **67 a 89** (64 a 86 sem a investigação WP4a) | |

Conclusão: com uma pessoa, a camada 1 completa leva de **13 a 18 semanas**. Para caber em 60 dias corridos seria preciso duas ou mais pessoas construindo em paralelo, o que também exige separar áreas de arquivo para não haver conflito.

### 5.2 O que já existe e reduz o trabalho

Núcleo de tenant e RLS, Stripe, créditos e trial, convites, auditoria, busca por IA e sinais gratuitos, Kanban (a adaptar), componentes de interface, extração de dados de empresa por CNPJ (BrasilAPI), regras de honestidade da IA. O CRM entrega o desenho já testado de funil, atividade, contrato e SLA, o que evita decisões novas.

### 5.3 Versão mínima em 30 dias (MVP para os 10 fundadores)

Escopo congelado, nesta ordem. Estimativa: **cerca de 30 dias úteis**.

| # | Entrega do MVP | Dias | Corte feito |
|---|---|---|---|
| 1 | Ambiente de testes + teste de RLS (WP0, versão mínima) | 3 | — |
| 2 | Conta, Contato, Oportunidade, Origem, Funil/Etapa (WP1, só o que o MVP usa) | 6 | Sem Campanha e sem Contrato ainda; sem OpportunityContact |
| 3 | Pacote de contabilidade v1 com funil, sinais e mensagens, instalado na criação da organização (WP2, mínimo) | 5 | Um só pacote; edição de pacote só por nós |
| 4 | Prospecção: lista de contas-alvo com nota e justificativa + sinal "empresa recém-aberta" pela base da Receita (WP4a + WP4b mínimo) | 7 | Sem mudança de porte e sem saída do Simples; condicionado ao resultado da investigação |
| 5 | CRM mínimo: Kanban dinâmico, ficha da conta com vários contatos, tarefas, ganho e perda | 5 | Sem contratos, sem metas, sem importação de CSV |
| 6 | Uma landing page (abertura de empresa) criada pelo Spinos, formulário caindo na conta (WP5, mínimo) | 4 | Um modelo; ponte transitória com o Sites |
| 7 | Origem do lead em toda entrada + painel mínimo de resultados (WP6 mínimo) | 2 | Só contagem por origem e etapa |
| 8 | Onboarding guiado + planos da tese + Stripe real + preço de fundador (WP7, mínimo) | 3 | Onboarding assistido pela equipe nas primeiras semanas |
| | **Total** | **≈ 35** | |

Soma 35 contra 30. Para chegar nos 30: o item 4 pode entrar como segunda onda (os fundadores recebem a lista inicial gerada pela busca por IA que já existe), e o item 8 fica em versão mínima. **Mesmo assim, a margem é zero.** O cenário honesto é de 5 a 7 semanas corridas para o MVP, e é por isso que a venda dos fundadores não deve esperar o produto pronto: o diagnóstico gratuito da tese e o preço de fundador servem para fechar já, com entrega do MVP em fases dentro dos primeiros 30 dias de contrato.

### 5.4 Cronograma de referência (uma pessoa, MVP em primeiro lugar)

| Semana | Foco |
|---|---|
| 1 | WP0, WP4a (investigação da Receita), início do WP1 |
| 2 a 3 | WP1 (modelo e cópia dos dados), WP2 mínimo (pacote) |
| 3 a 4 | CRM mínimo, prospecção com sinal de empresa recém-aberta |
| 5 | Landing page, origem e painel mínimo, onboarding, Stripe real |
| 6 | Correções, 3 a 5 fundadores em uso, medir |
| 7 a 17 | Completar a camada 1 (WP3 completo, WP4b completo, WP5 completo, WP6, WP7, WP8, WP9), conforme os fundadores pedirem |

### 5.5 Critérios de aceite da camada 1

1. Um escritório novo configura sozinho em até 7 dias, sem ajuda de código nem customização.
2. Entrar em um nicho novo exige só criar um pacote (teste: criar um pacote fictício de outro nicho e instalar sem alterar código).
3. Nenhuma palavra de nicho fora de `packs/` (teste automático).
4. Toda tabela do tenant tem RLS e teste de isolamento entre duas organizações.
5. Cada oportunidade ganha mostra de onde veio o lead (origem, canal, campanha, página).
6. Todo contato tem base legal registrada e descadastro.
7. Os sistemas atuais continuam funcionando durante toda a camada 1.

---

## 6. Riscos técnicos

| # | Risco | Impacto | Resposta |
|---|---|---|---|
| R1 | **Base da Receita não entrega os sinais** (layout, frequência, tamanho, histórico para detectar mudança) | Alto: o diferencial "encontra leads novos" do nicho depende disso | WP4a de 3 dias antes de comprometer prazo; MVP só com "recém-aberta"; fallback para a busca por IA que já existe |
| R2 | **Prazo:** 67 a 89 dias úteis para uma pessoa contra a meta de 60 dias corridos | Alto | MVP cortado (5.3); portões de decisão; segunda pessoa só com separação de áreas de arquivo |
| R3 | **Dois padrões de isolamento** (RLS por login no CRM, contexto de organização no Spinos) | Médio: copiar o código do CRM quebra o isolamento | Portar o modelo, não o código; um padrão só; teste de RLS em toda tabela |
| R4 | **Sem ambiente de testes** no Spinos (testa-se no domínio ao vivo) com clientes pagantes em cima | Alto: a auditoria do CRM já registrou o mesmo problema (desenvolvimento no banco de produção) | WP0: segundo projeto Supabase ou ramo de banco e preview na Vercel (custo a confirmar, D8) |
| R5 | **Migração do modelo antigo** pode perder dados ou mudar o comportamento percebido | Médio | Expandir, copiar, trocar por flag, limpar só depois; conferência manual (9 organizações); reversão por flag |
| R6 | **Pulse sem tenant e com acesso compartilhado** (Google Ads, Meta) | Alto para a camada 2 | Reescrever o acesso a dados; OAuth por organização; **aprovação do Google Ads para uso multi-conta** pode levar semanas e não está confirmada |
| R7 | **Sites** com mídia no repositório, conteúdo preso a clientes e domínio por chamada à API da Vercel | Médio | Gerador novo (não reaproveita os seeds); tirar mídia do repo antes de escalar; ADR do próprio Sites cita ~500 sites como ponto de reavaliar |
| R8 | **LGPD e e-mail frio:** dados públicos de sócios e contatos da Receita são dados pessoais; o briefing pede base legal de legítimo interesse | Alto | Só dados profissionais e públicos, teste de legítimo interesse documentado, descadastro em toda comunicação, **sem disparo de e-mail frio em massa na camada 1**; **revisão por advogado** antes de abrir para clientes (não consigo substituir parecer jurídico) |
| R9 | **Regras de publicidade do conselho de contabilidade** podem limitar o texto das landing pages e abordagens dos escritórios | Médio | Verificar as normas vigentes antes de escrever os modelos e roteiros (não pesquisei, **não confirmado**) |
| R10 | **Arquivos do Storage não entram no backup do banco** (o Spinos já tem Licitações com Storage) | Médio | Definir cópia dos arquivos antes de guardar documentos de clientes; vale para o gerador de landing também |
| R11 | **Custo de IA** da busca e dos sinais por conta cresce com a base de contas | Médio | Já existe log de custo por busca; manter limites por plano e créditos |
| R12 | **Versões diferentes** de Next (16.3 e 16.4), React, ORM (Prisma, Drizzle, supabase-js) entre os sistemas | Baixo a médio | Alinhar versões antes de mover pacotes; manter o Prisma como único acesso ao banco do núcleo |
| R13 | **Tempo seu dividido** com a agência | Alto | A tese já prevê contratar o gestor de tráfego; manter a regra de uma frente por vez |

---

## 7. Decisões que dependem de você

| # | Decisão | Minha recomendação |
|---|---|---|
| D1 | ~~Congelar o módulo Licitações~~ | **Decidido: remover.** Feito no código; falta publicar e aplicar a migração |
| D2 | **O banco e o login do Spinos viram o núcleo único?** (os outros três continuam separados até migrarem) | Sim, nesta ordem: Spinos, depois CRM, Sites, Pulse |
| D3 | **Destino do Sites:** (A) ponte transitória e depois unificar o banco, ou (B) manter o banco do Sites separado para sempre, só integrando por API | A, com data para acabar a ponte. B contradiz o requisito de "módulos internos, não integração por API" |
| D4 | **Quem escreve o pacote de contabilidade** (etapas do funil, mensagens, modelos de landing, vocabulário)? Precisa de conhecimento do nicho | Você, com os clientes contábeis da carteira, em uma sessão de 2 a 3 horas; eu escrevo e você revisa |
| D5 | ~~Investigação da base da Receita~~ | **Aprovada** |
| D6 | **Planos e preços no produto:** Essencial, Crescimento e Aceleração (R$ 497, 997, 1.997 + setup R$ 1.500) contra o `plans.ts` atual (R$ 309, 649, 1.699), e como travar o preço de fundador por 12 meses | Redefinir `plans.ts` pela tese; preço de fundador por cupom ou preço personalizado no Stripe. Confirmar limites por plano (contas, usuários, buscas) |
| D7 | **E-mail frio em massa fica fora da camada 1** | Concordo em deixar fora; abordagem por WhatsApp e LinkedIn feita pelo usuário, e e-mail só com descadastro e na camada 3 |
| D8 | ~~Ambiente de testes~~ | **Decidido: não terá.** Mitigação na atualização do topo |
| D9 | **Capacidade:** uma pessoa (Claude + você revisando) ou uma segunda pessoa de código | Uma pessoa para o MVP; segunda só depois do modelo unificado pronto (WP1), com áreas de arquivo separadas |

---

## 8. Impacto no que está em andamento

- **Licitações (Spinos):** etapas 0 a 3 feitas e commitadas; o commit da etapa 3 (análise por IA, `5915642`) **ainda não foi enviado nem publicado**, esperando sua autorização. As etapas 4 a 8 estão pendentes. Pelo filtro da tese ("isso ajuda a chegar nos próximos clientes pagantes do ICP?"): **não ajuda**. Recomendo congelar (D1). O trabalho feito não é perdido: continua atrás de flag.
- **E-mail e DNS do Spinos:** concluído. Não afeta o plano.
- **Tudo o mais** (agência, Era Uma Vez um Real, Atlas, perfil @cyromello): sem mudança, conforme a tabela de foco da tese.

## 9. Próximo passo

**Você aprova, ajusta ou recusa este plano.** Se aprovar, a primeira semana é WP0 + WP4a (ambiente de testes, teste de RLS e a investigação da base da Receita), com resultado em 5 dias úteis para decidir o escopo final do MVP. Eu não começo nada antes da sua resposta, principalmente às decisões D1, D5 e D8.

---

## Apêndice: o que não foi confirmado

- Número real de usuários e organizações nos bancos do CRM, Pulse e Sites (os relatórios vieram dos repositórios, não dos bancos).
- Estado em produção de cada um dos 21 sites do Everest Sites (domínios, publicados ou em implantação).
- Se a conta SES do CRM saiu do sandbox e se há campanhas reais.
- Se a vulnerabilidade F07 do CRM (vendedor altera negócio de colega) foi corrigida (existe a migração `member_guards`).
- Colunas exatas e frequência de atualização da base de CNPJ da Receita (WP4a resolve).
- Se o CRM consome o campo `attribution` do webhook do Sites.
- Normas de publicidade do conselho de contabilidade aplicáveis a escritórios.
- Aprovação do Google Ads para uso multi-conta por clientes finais.
