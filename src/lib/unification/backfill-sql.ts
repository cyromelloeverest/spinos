// Cópia do modelo antigo (OpportunityScore) para o modelo unificado (Conta,
// Contato, Oportunidade, Origem). SQL puro, em uma transação, seguro de repetir:
// cada passo só cria o que ainda não existe. Não apaga nem altera as colunas
// antigas (a limpeza é uma fase posterior, com autorização à parte).

export const BACKFILL_STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "funil padrão 'Geral B2B' em toda organização que ainda não tem funil padrão",
    sql: `
INSERT INTO pipelines (id, "organizationId", name, "isDefault")
SELECT gen_random_uuid()::text, o.id, 'Geral B2B', true
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM pipelines p WHERE p."organizationId" = o.id AND p."isDefault")`,
  },
  {
    name: "as 5 etapas de hoje no funil padrão",
    sql: `
INSERT INTO stages (id, "organizationId", "pipelineId", key, name, position, kind)
SELECT gen_random_uuid()::text, p."organizationId", p.id, v.key, v.name, v.position, v.kind::"StageKind"
FROM pipelines p
CROSS JOIN (VALUES
  ('CONTATO_FEITO',    'Contato feito',    1, 'OPEN'),
  ('VISITA_AGENDADA',  'Visita agendada',  2, 'OPEN'),
  ('PROPOSTA_ENVIADA', 'Proposta enviada', 3, 'OPEN'),
  ('VENDIDO',          'Vendido',          4, 'WON'),
  ('PERDIDO',          'Perdido',          5, 'LOST')
) AS v(key, name, position, kind)
WHERE p."isDefault" AND p.name = 'Geral B2B'
ON CONFLICT ("pipelineId", key) DO NOTHING`,
  },
  {
    name: "uma Conta por organização e empresa (a nota mais recente decide o ciclo de vida)",
    sql: `
INSERT INTO accounts (id, "organizationId", "companyId", name, cnpj, site, city, state, segment, lifecycle, "createdAt", "updatedAt")
SELECT DISTINCT ON (s."organizationId", s."companyId")
  gen_random_uuid()::text, s."organizationId", s."companyId", c.name, c.cnpj, c.site, c.city, c.state, c.segment,
  (CASE
     WHEN s.stage = 'VENDIDO' THEN 'CUSTOMER'
     WHEN s.stage = 'PERDIDO' THEN 'LOST'
     WHEN s.stage IS NOT NULL THEN 'ENGAGED'
     WHEN s.status = 'DISMISSED' THEN 'DISMISSED'
     ELSE 'TARGET'
   END)::"AccountLifecycle",
  s."computedAt", now()
FROM opportunity_scores s
JOIN companies c ON c.id = s."companyId"
WHERE s."accountId" IS NULL
ORDER BY s."organizationId", s."companyId", s."computedAt" DESC
ON CONFLICT ("organizationId", "companyId") DO NOTHING`,
  },
  {
    name: "ligar cada nota à sua Conta",
    sql: `
UPDATE opportunity_scores s
SET "accountId" = a.id
FROM accounts a
WHERE s."accountId" IS NULL
  AND a."organizationId" = s."organizationId"
  AND a."companyId" = s."companyId"`,
  },
  {
    name: "contato principal a partir dos campos de contato (só se existir algum)",
    sql: `
INSERT INTO contacts (id, "organizationId", "accountId", name, phone, email, "isPrimary", "createdAt", "updatedAt")
SELECT DISTINCT ON (s."accountId")
  gen_random_uuid()::text, s."organizationId", s."accountId",
  COALESCE(NULLIF(trim(s."contactName"), ''), 'Contato sem nome'),
  NULLIF(trim(s."contactPhone"), ''), NULLIF(trim(s."contactEmail"), ''), true, now(), now()
FROM opportunity_scores s
WHERE s."accountId" IS NOT NULL
  AND (NULLIF(trim(s."contactName"), '') IS NOT NULL OR NULLIF(trim(s."contactPhone"), '') IS NOT NULL OR NULLIF(trim(s."contactEmail"), '') IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM contacts ct WHERE ct."accountId" = s."accountId" AND ct."isPrimary")
ORDER BY s."accountId", s."computedAt" DESC`,
  },
  {
    name: "contato decisor a partir do decisor sugerido (só se houver nome)",
    sql: `
INSERT INTO contacts (id, "organizationId", "accountId", name, "jobTitle", "decisionRole", "isPrimary", "createdAt", "updatedAt")
SELECT DISTINCT ON (s."accountId", lower(trim(s."decisionMakerName")))
  gen_random_uuid()::text, s."organizationId", s."accountId", trim(s."decisionMakerName"),
  NULLIF(trim(s."decisionMaker"), ''), 'decisor', false, now(), now()
FROM opportunity_scores s
WHERE s."accountId" IS NOT NULL
  AND NULLIF(trim(s."decisionMakerName"), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contacts ct
    WHERE ct."accountId" = s."accountId" AND lower(trim(ct.name)) = lower(trim(s."decisionMakerName"))
  )
ORDER BY s."accountId", lower(trim(s."decisionMakerName")), s."computedAt" DESC`,
  },
  {
    name: "uma Oportunidade para cada Conta que já estava no funil",
    sql: `
INSERT INTO opportunities (id, "organizationId", "accountId", "primaryContactId", "pipelineId", "stageId", title, status, "closedAt", "stageChangedAt", "lastActionByUserId", "lastActionAt", "createdAt", "updatedAt")
SELECT DISTINCT ON (s."accountId")
  gen_random_uuid()::text, s."organizationId", s."accountId",
  (SELECT ct.id FROM contacts ct WHERE ct."accountId" = s."accountId" AND ct."isPrimary" LIMIT 1),
  st."pipelineId", st.id, s.headline,
  (CASE WHEN s.stage = 'VENDIDO' THEN 'WON' WHEN s.stage = 'PERDIDO' THEN 'LOST' ELSE 'OPEN' END)::"DealStatus",
  CASE WHEN s.stage IN ('VENDIDO', 'PERDIDO') THEN COALESCE(s."stageUpdatedAt", s."computedAt") END,
  COALESCE(s."stageUpdatedAt", s."computedAt"), s."lastActionByUserId", s."lastActionAt", s."computedAt", now()
FROM opportunity_scores s
JOIN pipelines p ON p."organizationId" = s."organizationId" AND p."isDefault" AND p.name = 'Geral B2B'
JOIN stages st ON st."pipelineId" = p.id AND st.key = s.stage::text
WHERE s."accountId" IS NOT NULL AND s.stage IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o."accountId" = s."accountId")
ORDER BY s."accountId", s."computedAt" DESC`,
  },
  {
    name: "histórico de etapa inicial para cada Oportunidade sem histórico",
    sql: `
INSERT INTO opportunity_stage_events (id, "organizationId", "opportunityId", "fromStageId", "toStageId", "createdAt")
SELECT gen_random_uuid()::text, o."organizationId", o.id, NULL, o."stageId", o."stageChangedAt"
FROM opportunities o
WHERE NOT EXISTS (SELECT 1 FROM opportunity_stage_events e WHERE e."opportunityId" = o.id)`,
  },
  {
    name: "primeiro toque de origem (prospecção do Spinos) para cada Conta sem origem",
    sql: `
INSERT INTO origins (id, "organizationId", kind, channel, "accountId", "isFirstTouch", "occurredAt")
SELECT gen_random_uuid()::text, a."organizationId", 'PROSPECTING'::"OriginKind", 'spinos',
       a.id, true, COALESCE((SELECT min(s."computedAt") FROM opportunity_scores s WHERE s."accountId" = a.id), a."createdAt")
FROM accounts a
WHERE NOT EXISTS (SELECT 1 FROM origins og WHERE og."accountId" = a.id)`,
  },
  {
    name: "responsável da negociação = quem fez a última ação, quando ainda não há responsável",
    sql: `
UPDATE opportunities
SET "ownerUserId" = "lastActionByUserId"
WHERE "ownerUserId" IS NULL AND "lastActionByUserId" IS NOT NULL`,
  },
];

export async function runBackfill(exec: (sql: string) => Promise<unknown>): Promise<void> {
  for (const step of BACKFILL_STATEMENTS) await exec(step.sql);
}
