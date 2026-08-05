-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "organizationId" TEXT,
    "targetId" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_events_type_createdAt_idx" ON "security_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_organizationId_createdAt_idx" ON "security_events"("organizationId", "createdAt");

-- RLS: defesa em profundidade, mesma lógica das outras tabelas.
ALTER TABLE "security_events" ENABLE ROW LEVEL SECURITY;
