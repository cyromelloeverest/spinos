-- search_credit_purchases é uma tabela de tenant nova (feature de créditos
-- avulsos de busca) que ainda não tinha policy de RLS — mesmo padrão das
-- outras tabelas diretas por organizationId.
CREATE POLICY tenant_isolation ON "search_credit_purchases"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
