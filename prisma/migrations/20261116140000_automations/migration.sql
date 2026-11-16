
-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "automationKey" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "opportunityId" TEXT,
    "activityId" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automations_organizationId_key_key" ON "automations"("organizationId", "key");

-- CreateIndex
CREATE INDEX "automation_runs_organizationId_createdAt_idx" ON "automation_runs"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_organizationId_dedupeKey_key" ON "automation_runs"("organizationId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: mesmo padrão das demais tabelas de cliente.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['automations','automation_runs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.current_org_id'', true)) WITH CHECK ("organizationId" = current_setting(''app.current_org_id'', true))',
      t);
  END LOOP;
END $$;
