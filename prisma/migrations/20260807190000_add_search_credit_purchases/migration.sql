-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "searchCreditBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "search_credit_purchases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountBRL" INTEGER NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_credit_purchases_stripeCheckoutSessionId_key" ON "search_credit_purchases"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "search_credit_purchases_organizationId_createdAt_idx" ON "search_credit_purchases"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "search_credit_purchases" ADD CONSTRAINT "search_credit_purchases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: defesa em profundidade, mesma lógica das outras tabelas (a conexão
-- do Prisma usa a role "postgres" com BYPASSRLS, então isso só importa se a
-- tabela for exposta via Data API do Supabase no futuro).
ALTER TABLE "search_credit_purchases" ENABLE ROW LEVEL SECURITY;
