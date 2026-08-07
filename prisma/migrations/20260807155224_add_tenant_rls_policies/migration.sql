-- Fase A do RLS estrutural: policies reais baseadas em organizationId.
-- A role "postgres" (usada pelo app hoje) tem BYPASSRLS, então isso é
-- 100% no-op pro app em produção — só passa a valer quando (e se) uma
-- conexão sem BYPASSRLS for usada, com app.current_org_id setado.

-- Tabelas de tenant: linha só é visível/editável se organizationId bater
-- com o contexto setado na sessão (current_setting, terceiro argumento
-- "true" = não lança erro se não tiver sido setado, só retorna NULL —
-- e NULL nunca bate com nada, então o resultado é "nega tudo" por padrão).
CREATE POLICY tenant_isolation ON "search_runs"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "memberships"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "invites"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "icps"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "opportunity_scores"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "feedbacks"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "chat_conversations"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "crm_exports"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "missions"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

-- organizations: a própria linha é a organização — compara o id dela mesma.
CREATE POLICY tenant_isolation ON "organizations"
  USING ("id" = current_setting('app.current_org_id', true))
  WITH CHECK ("id" = current_setting('app.current_org_id', true));

-- Tabelas sem organizationId direto: sobe até a tabela-pai via subquery.
CREATE POLICY tenant_isolation ON "opportunity_score_signals"
  USING (EXISTS (
    SELECT 1 FROM "opportunity_scores" os
    WHERE os."id" = "opportunity_score_signals"."opportunityScoreId"
      AND os."organizationId" = current_setting('app.current_org_id', true)
  ));

CREATE POLICY tenant_isolation ON "chat_messages"
  USING (EXISTS (
    SELECT 1 FROM "chat_conversations" cc
    WHERE cc."id" = "chat_messages"."conversationId"
      AND cc."organizationId" = current_setting('app.current_org_id', true)
  ));

-- users: identidade global (uma pessoa pode estar em mais de uma org), só
-- visível se for membro da org do contexto atual.
CREATE POLICY tenant_isolation ON "users"
  USING (EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."userId" = "users"."id"
      AND m."organizationId" = current_setting('app.current_org_id', true)
  ));

-- Tabelas globais (Company/Signal): fato objetivo, não pertence a nenhum
-- tenant — leitura e criação livres pra qualquer conexão autenticada,
-- sem checagem de organizationId (não existe essa coluna nelas).
CREATE POLICY global_read ON "companies" FOR SELECT USING (true);
CREATE POLICY global_insert ON "companies" FOR INSERT WITH CHECK (true);
CREATE POLICY global_read ON "signals" FOR SELECT USING (true);
CREATE POLICY global_insert ON "signals" FOR INSERT WITH CHECK (true);

-- Fora de escopo nesta fase (decisão de design pendente, ver relatório):
-- security_events, auth_attempts. Continuam RLS-ligado-sem-policy
-- (nega tudo pra role sem bypass) — mesmo estado de hoje, nada piora.
