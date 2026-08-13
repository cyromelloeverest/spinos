-- CreateTable
CREATE TABLE "search_usage_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheCreationTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL,
    "webSearchCount" INTEGER NOT NULL,
    "estimatedCostUSD" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_usage_logs_organizationId_createdAt_idx" ON "search_usage_logs"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "search_usage_logs" ADD CONSTRAINT "search_usage_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS (defesa em profundidade, mesmo padrão de todas as outras
-- tabelas de tenant — ver search_runs).
ALTER TABLE "search_usage_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "search_usage_logs"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
