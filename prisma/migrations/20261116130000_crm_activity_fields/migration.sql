-- CRM (primeira entrega): título e automação de origem nas atividades, e tipo de
-- cobrança (venda única ou recorrente) na oportunidade. Só acrescenta.

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'RECURRING');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "automation" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "billing" "BillingType" NOT NULL DEFAULT 'ONE_TIME';
