# Desenho do WP1: modelo de dados unificado

Data: 2026-11-15. Status: **para revisão. Nada foi aplicado no banco nem no `schema.prisma`.** O rascunho abaixo foi validado pelo Prisma (`prisma validate`) e o SQL que ele gera foi conferido: só **acrescenta** tabelas e uma coluna (`opportunity_scores.accountId`, opcional). Não remove nem altera nada existente.

## 1. O que este desenho resolve

Hoje o Spinos guarda tudo sobre uma empresa-alvo numa tabela só, `OpportunityScore`: a nota da IA, o nome e o telefone do contato e a etapa do funil, que é um enum fixo de 5 valores. Isso impede o que o briefing pede: vários contatos por conta, funil configurável por nicho, atividades, origem do lead e campanha.

O desenho separa em entidades próprias, todas do cliente (com `organizationId` e RLS):

```
Company (global, já existe)        fatos públicos sobre empresas
   │ 0..1
Account (Conta)  ──< Contact (Contato)
   │  \                 │
   │   \──< Origin (toques: de onde veio)  >── Campaign
   │
   ├──< Opportunity ──> Pipeline / Stage / LossReason
   │        │  └──< OpportunityStageEvent (histórico)
   │        └──< Activity (também liga a Conta e a Contato)
   │
   └──< OpportunityScore (já existe: nota da IA, ganha accountId)
OrganizationPack: qual pacote de nicho está instalado
```

**Regra de ouro (chave composta):** todo filho aponta para o pai com `(id, organizationId)`. O banco impede um registro da organização A de apontar para um registro da organização B, mesmo que o código erre. É o padrão que já usamos e que o CRM também adotou.

## 2. Decisões de desenho (para você confirmar)

1. **`Company` continua global e intocada.** É o cadastro público compartilhado (7.468 empresas hoje, 7.463 com CNPJ). `Account` é a visão **da organização** sobre uma empresa, com `companyId` opcional: uma conta pode existir sem CNPJ (por exemplo, um lead que chegou por formulário).
2. **Lead não é uma tabela.** Um lead é uma `Account` (ou `Contact`) recém-criada com um registro de origem. O que chega por formulário vira `Origin` do tipo `LANDING_PAGE`. A fila de atendimento (com prazo de primeira resposta) usa `Opportunity.firstResponseAt`.
3. **Etapas do funil são dados** (`Stage`), não enum. Cada etapa tem um tipo: aberta, ganha ou perdida. Isso permite que cada nicho tenha seu funil, e que "Visita agendada" (conceito de venda de campo) exista só onde fizer sentido.
4. **Contato nasce com base legal.** `legalBasis` (legítimo interesse, consentimento ou contrato), `optedOutAt` e `anonymizedAt`. Um contato ligado a uma oportunidade **não é apagado** (a chave é `Restrict`): é anonimizado, que é o que a LGPD pede de qualquer forma.
5. **Origem é um registro por toque**, não um campo. Primeiro toque marcado em `isFirstTouch`. Guarda UTM (5), `gclid` e `fbclid`. Isso responde "de onde veio cada cliente" sem perder os toques seguintes, e deixa o terreno pronto para o ABM completo.
6. **Preparado para o ABM completo, sem construir:** `Opportunity.primaryContactId` (mais contatos por conta já cabem em `Contact`), `Activity.cadenceId` (reservado, sem uso), `Activity.type` com WhatsApp e LinkedIn, `Origin.campaignId` para públicos de anúncio.
7. **Fora do WP1** (para não inflar): contratos e MRR (WP3), `Inquiry` do formulário e `LandingPage` (WP5), metas, e-mail marketing. A coluna `Origin.landingPageId` já existe como texto solto para ligar depois.
8. **Moeda** em reais (`...BRL`), como o resto do Spinos. Multi-moeda fica para quando existir cliente fora do Brasil.
9. **CNPJ como texto livre de 14 caracteres** (aceita letras, por causa do CNPJ alfanumérico de julho de 2026). A validação de formato fica no código, não na coluna.

## 3. O rascunho do schema

Fica só neste documento. Não está no `schema.prisma`.

```prisma
// ============================================================
// MODELO UNIFICADO (rascunho do WP1) — tudo do tenant com RLS e FK composta.
// ============================================================

enum AccountLifecycle {
  TARGET     // conta-alvo, ainda sem contato
  ENGAGED    // em contato / em negociação
  CUSTOMER   // cliente
  LOST       // perdida
  DISMISSED  // descartada
}

enum StageKind {
  OPEN
  WON
  LOST
}

enum DealStatus {
  OPEN
  WON
  LOST
}

enum ActivityType {
  CALL
  WHATSAPP
  EMAIL
  LINKEDIN
  MEETING
  PROPOSAL
  TASK
  OTHER
}

enum ActivityStatus {
  OPEN
  DONE
  CANCELED
}

enum OriginKind {
  PROSPECTING
  LANDING_PAGE
  AD
  REFERRAL
  MANUAL
  IMPORT
  OTHER
}

enum CampaignKind {
  AD
  EMAIL
  OUTBOUND
  EVENT
  OTHER
}

enum LegalBasis {
  LEGITIMATE_INTEREST
  CONSENT
  CONTRACT
}

model OrganizationPack {
  id             String   @id @default(cuid())
  organizationId String   @unique
  packKey        String
  packVersion    String
  snapshot       Json
  installedAt    DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("organization_packs")
}

model Pipeline {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  isDefault      Boolean  @default(false)
  createdAt      DateTime @default(now())

  organization  Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  stages        Stage[]
  opportunities Opportunity[]

  @@unique([id, organizationId])
  @@map("pipelines")
}

model Stage {
  id             String    @id @default(cuid())
  organizationId String
  pipelineId     String
  key            String
  name           String
  position       Int
  kind           StageKind @default(OPEN)
  targetPct      Float?

  pipeline      Pipeline      @relation(fields: [pipelineId, organizationId], references: [id, organizationId], onDelete: Cascade)
  opportunities Opportunity[]
  events        OpportunityStageEvent[]

  @@unique([id, organizationId])
  @@unique([pipelineId, key])
  @@map("stages")
}

model LossReason {
  id             String  @id @default(cuid())
  organizationId String
  key            String
  label          String
  requiresNote   Boolean @default(false)
  position       Int     @default(0)

  organization  Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  opportunities Opportunity[]

  @@unique([id, organizationId])
  @@unique([organizationId, key])
  @@map("loss_reasons")
}

model Campaign {
  id             String       @id @default(cuid())
  organizationId String
  kind           CampaignKind
  channel        String?
  name           String
  externalRef    String?
  spendBRL       Float?
  startsAt       DateTime?
  endsAt         DateTime?
  createdAt      DateTime     @default(now())

  organization  Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  origins       Origin[]
  opportunities Opportunity[]

  @@unique([id, organizationId])
  @@map("campaigns")
}

model Account {
  id             String           @id @default(cuid())
  organizationId String
  companyId      String?
  name           String
  cnpj           String?
  site           String?
  city           String?
  state          String?
  segment        String?
  lifecycle      AccountLifecycle @default(TARGET)
  ownerUserId    String?
  customFields   Json?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  organization  Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  company       Company?        @relation(fields: [companyId], references: [id], onDelete: SetNull)
  contacts      Contact[]
  opportunities Opportunity[]
  activities    Activity[]
  origins       Origin[]
  scores        OpportunityScore[]

  @@unique([id, organizationId])
  @@unique([organizationId, companyId])
  @@unique([organizationId, cnpj])
  @@index([organizationId, lifecycle])
  @@map("accounts")
}

model Contact {
  id             String      @id @default(cuid())
  organizationId String
  accountId      String?
  name           String
  jobTitle       String?
  decisionRole   String?
  email          String?
  phone          String?
  phoneE164      String?
  linkedinUrl    String?
  isPrimary      Boolean     @default(false)
  legalBasis     LegalBasis?
  legalBasisNote String?
  optedOutAt     DateTime?
  anonymizedAt   DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  organization  Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account       Account?      @relation(fields: [accountId, organizationId], references: [id, organizationId], onDelete: Cascade)
  opportunities Opportunity[]
  activities    Activity[]
  origins       Origin[]

  @@unique([id, organizationId])
  @@index([organizationId, accountId])
  @@index([organizationId, phoneE164])
  @@map("contacts")
}

model Opportunity {
  id                 String             @id @default(cuid())
  organizationId     String
  accountId          String
  primaryContactId   String?
  pipelineId         String
  stageId            String
  title              String
  expectedValueBRL   Float?
  wonValueBRL        Float?
  status             DealStatus @default(OPEN)
  lossReasonId       String?
  lossNote           String?
  closedAt           DateTime?
  stageChangedAt     DateTime           @default(now())
  nextActivityAt     DateTime?
  ownerUserId        String?
  campaignId         String?
  firstResponseAt    DateTime?
  lastActionByUserId String?
  lastActionAt       DateTime?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account        Account      @relation(fields: [accountId, organizationId], references: [id, organizationId], onDelete: Cascade)
  primaryContact Contact?     @relation(fields: [primaryContactId, organizationId], references: [id, organizationId], onDelete: Restrict)
  pipeline       Pipeline     @relation(fields: [pipelineId, organizationId], references: [id, organizationId])
  stage          Stage        @relation(fields: [stageId, organizationId], references: [id, organizationId])
  lossReason     LossReason?  @relation(fields: [lossReasonId, organizationId], references: [id, organizationId])
  campaign       Campaign?    @relation(fields: [campaignId, organizationId], references: [id, organizationId])
  activities     Activity[]
  stageEvents    OpportunityStageEvent[]
  origins        Origin[]

  @@unique([id, organizationId])
  @@index([organizationId, status, stageId])
  @@map("opportunities")
}

model OpportunityStageEvent {
  id             String   @id @default(cuid())
  organizationId String
  opportunityId  String
  fromStageId    String?
  toStageId      String
  userId         String?
  createdAt      DateTime @default(now())

  opportunity Opportunity @relation(fields: [opportunityId, organizationId], references: [id, organizationId], onDelete: Cascade)
  toStage     Stage       @relation(fields: [toStageId, organizationId], references: [id, organizationId])

  @@index([opportunityId, createdAt])
  @@map("opportunity_stage_events")
}

model Activity {
  id              String         @id @default(cuid())
  organizationId  String
  type            ActivityType
  accountId       String?
  contactId       String?
  opportunityId   String?
  ownerUserId     String?
  dueAt           DateTime?
  doneAt          DateTime?
  status          ActivityStatus @default(OPEN)
  outcome         String?
  notes           String?
  cadenceId       String?
  clientRequestId String?
  createdAt       DateTime       @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account?     @relation(fields: [accountId, organizationId], references: [id, organizationId], onDelete: Cascade)
  contact      Contact?     @relation(fields: [contactId, organizationId], references: [id, organizationId], onDelete: Cascade)
  opportunity  Opportunity? @relation(fields: [opportunityId, organizationId], references: [id, organizationId], onDelete: Cascade)

  @@unique([organizationId, clientRequestId])
  @@index([organizationId, status, dueAt])
  @@map("activities")
}

model Origin {
  id             String     @id @default(cuid())
  organizationId String
  kind           OriginKind
  channel        String?
  campaignId     String?
  landingPageId  String?
  accountId      String?
  contactId      String?
  opportunityId  String?
  isFirstTouch   Boolean    @default(false)
  utmSource      String?
  utmMedium      String?
  utmCampaign    String?
  utmTerm        String?
  utmContent     String?
  gclid          String?
  fbclid         String?
  referrerHost   String?
  occurredAt     DateTime   @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  campaign     Campaign?    @relation(fields: [campaignId, organizationId], references: [id, organizationId])
  account      Account?     @relation(fields: [accountId, organizationId], references: [id, organizationId], onDelete: Cascade)
  contact      Contact?     @relation(fields: [contactId, organizationId], references: [id, organizationId], onDelete: Cascade)
  opportunity  Opportunity? @relation(fields: [opportunityId, organizationId], references: [id, organizationId], onDelete: Cascade)

  @@index([organizationId, accountId])
  @@index([organizationId, kind, occurredAt])
  @@map("origins")
}
```

Mais duas mudanças pequenas no schema atual: `OpportunityScore.accountId` (opcional, com chave para `Account`) e as listas de relações nas tabelas `Organization` e `Company`.

## 4. Como os dados atuais migram

**Tamanho real da migração (consultei o banco só com leitura):**

| Organização | Notas (`OpportunityScore`) | Já no funil | Feedbacks |
|---|---|---|---|
| Agência Everest Marketing | 17 | 8 | 2 |
| Sakatec | 15 | 1 | 0 |
| Bottoli Advocacia | 10 | 1 | 0 |
| MK Compliance | 10 | 0 | 0 |
| 0800Flex | 6 | 0 | 0 |
| Outras 4 organizações | 0 | 0 | 0 |
| **Total** | **58** | **10** (2 `VISITA_AGENDADA`, 6 `CONTATO_FEITO`, 2 `VENDIDO`) | **2** (`CONVERTED`) |

Só 1 linha tem dado de contato preenchido. A migração é pequena e pode ser conferida à mão.

**Regra de cópia (um script que pode rodar mais de uma vez sem duplicar, chaveado pelo id da nota):**

| De | Para |
|---|---|
| Cada `OpportunityScore` | 1 `Account` (por organização e empresa) e o campo `accountId` da própria nota |
| `stage = VENDIDO` | `Account.lifecycle = CUSTOMER` |
| `stage = PERDIDO` | `Account.lifecycle = LOST` |
| outra `stage` preenchida | `Account.lifecycle = ENGAGED` |
| `status = DISMISSED` | `Account.lifecycle = DISMISSED` |
| demais | `Account.lifecycle = TARGET` |
| `contactName/Phone/Email` | 1 `Contact` principal (só se houver algum dos três) |
| `decisionMakerName` + `decisionMaker` (cargo) | 1 `Contact` com `decisionRole` (só se houver nome) |
| `stage` preenchida | 1 `Opportunity` num funil "Geral B2B" (as 5 etapas de hoje) + 1 evento de histórico |
| `VENDIDO` / `PERDIDO` | etapa do tipo ganha / perdida |
| `computedAt` | 1 `Origin` do tipo `PROSPECTING`, `isFirstTouch = true` |
| `Feedback` | continua como está (ganha ligação à conta no WP3) |
| `CrmExport` | continua como está (0 linhas hoje) |

**Todas as organizações existentes recebem o funil "Geral B2B"** com exatamente as 5 etapas atuais (Contato feito, Visita agendada, Proposta enviada, Vendido, Perdido). Para quem usa hoje, **a tela não muda**. O pacote de contabilidade só vale para organizações novas.

**Pendência de dado:** os contatos migrados não têm base legal registrada. Proponho deixar `legalBasis` **vazio** (não afirmar uma base que não foi registrada) e pedir que a tela mostre "a registrar".

## 5. Como colocar no ar sem quebrar nada

1. **Expandir:** migração aditiva (as tabelas novas e `opportunity_scores.accountId`), com RLS em todas. O teste automático de RLS que criamos no WP0 já cobre isso.
2. **Copiar:** rodar o script de cópia. Conferir contagens: 58 contas, 10 oportunidades, 5 etapas por organização.
3. **Trocar o código** para ler e gravar nas tabelas novas, **em uma publicação só**. Com 58 registros e 13 usuários, não vale a complexidade de gravar nos dois modelos ao mesmo tempo.
4. **Copiar de novo**, logo depois do deploy, para pegar qualquer nota que o código antigo tenha criado entre a primeira cópia e a troca. O script é seguro de repetir.
5. **Limpar** (só depois de 30 dias estáveis e com a sua autorização): remover do `OpportunityScore` as colunas de contato e de etapa, e os enums antigos.

**Reversão até o passo 4:** voltar a publicação anterior. As colunas antigas continuam intactas e preenchidas.

**Quanto código muda:** 20 arquivos mexem em `OpportunityScore` (as páginas de oportunidades, pipeline, radar, histórico, painel inicial, exportação, assistente de vendas, a busca por IA e o cruzamento de sinais). O enum `PipelineStage` aparece em 5 arquivos, `SignalCategory` em 9, os campos de contato em 8.

## 6. Testes do WP1

- O teste de RLS do WP0 (já existe) falha se alguma tabela nova ficar sem isolamento.
- **Teste de isolamento entre duas organizações:** criar a organização A e a B, tentar ler e gravar a conta de uma estando no contexto da outra, e confirmar que falha. Hoje o Spinos não tem teste que use banco de verdade. Proposta: o mesmo método do CRM (Postgres em memória). Isso está dentro da estimativa do WP1.
- Teste do script de cópia: rodar duas vezes e conferir que não duplica.
- Os testes atuais de pipeline e busca são ajustados ao novo modelo.

## 7. Riscos específicos do WP1

| Risco | Resposta |
|---|---|
| Trocar o código em uma publicação só é uma mudança grande (20 arquivos) | Publicar em horário de baixo uso; copiar de novo logo depois; reversão por publicação anterior; sem staging, então revisar o diff com cuidado |
| O funil "Geral B2B" para as organizações atuais precisa reproduzir o comportamento de hoje | Conferir as 10 oportunidades uma a uma contra a tela antiga |
| `Contact` vazio de base legal | Mostrar "a registrar" e exigir o preenchimento ao editar |
| Chave composta aumenta a verbosidade do código | Já é o padrão do projeto; centralizar em funções de acesso |

## 8. O que preciso de você

1. **Aprovar o desenho** (seções 1 a 3), ou apontar o que mudar.
2. **Confirmar as três decisões que mexem em regra de negócio:**
   - "Lead não é tabela" (decisão 2): todo lead é uma conta com origem. Concorda?
   - Contato ligado a oportunidade só é anonimizado, nunca apagado (decisão 4).
   - Organizações atuais recebem o funil "Geral B2B" com as 5 etapas de hoje e nada muda para elas.
3. **Autorizar o início da implementação**: primeiro a migração aditiva e o script de cópia (sem trocar o código), depois a troca do código.
