-- CreateTable
CREATE TABLE "auth_attempts" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_attempts_identifier_createdAt_idx" ON "auth_attempts"("identifier", "createdAt");

-- RLS: defesa em profundidade, mesma lógica das outras tabelas (a conexão
-- do Prisma usa a role "postgres" com BYPASSRLS, então isso só importa se a
-- tabela for exposta via Data API do Supabase no futuro).
ALTER TABLE "auth_attempts" ENABLE ROW LEVEL SECURITY;
