-- AlterTable
ALTER TABLE "opportunity_scores" ADD COLUMN     "missionId" TEXT;

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "missions_organizationId_createdAt_idx" ON "missions"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "opportunity_scores_missionId_idx" ON "opportunity_scores"("missionId");

-- AddForeignKey
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: defesa em profundidade, mesma lógica das outras tabelas (a conexão
-- do Prisma usa a role "postgres" com BYPASSRLS, então isso só importa se a
-- tabela for exposta via Data API do Supabase no futuro).
ALTER TABLE "missions" ENABLE ROW LEVEL SECURITY;
