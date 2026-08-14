-- Renomeia (não recria) — preserva o saldo e o histórico de compras já
-- existentes. O diff automático do Prisma geraria DROP COLUMN/DROP TABLE +
-- CREATE, que apagaria dado real (saldo pré-pago já concedido/comprado,
-- inclusive via Stripe em modo live) — por isso essa migração foi escrita
-- à mão em vez de gerada.

-- RenameColumn
ALTER TABLE "organizations" RENAME COLUMN "searchCreditBalance" TO "creditBalance";

-- RenameTable (preserva índices, FK e as policies de RLS já existentes —
-- todos ficam anexados ao mesmo objeto de tabela, só o nome muda)
ALTER TABLE "search_credit_purchases" RENAME TO "credit_purchases";

-- Os nomes de constraint/index gerados automaticamente pelo Prisma incluem
-- o nome antigo da tabela — renomeia pra manter consistência com o que o
-- schema.prisma novo espera encontrar (Prisma não exige isso pra
-- funcionar, mas evita confusão numa introspecção futura).
ALTER TABLE "credit_purchases" RENAME CONSTRAINT "search_credit_purchases_pkey" TO "credit_purchases_pkey";
ALTER TABLE "credit_purchases" RENAME CONSTRAINT "search_credit_purchases_organizationId_fkey" TO "credit_purchases_organizationId_fkey";
ALTER INDEX "search_credit_purchases_stripeCheckoutSessionId_key" RENAME TO "credit_purchases_stripeCheckoutSessionId_key";
ALTER INDEX "search_credit_purchases_organizationId_createdAt_idx" RENAME TO "credit_purchases_organizationId_createdAt_idx";
