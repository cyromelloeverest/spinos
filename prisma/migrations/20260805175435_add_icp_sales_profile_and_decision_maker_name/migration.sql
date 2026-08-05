-- CreateEnum
CREATE TYPE "SaleModel" AS ENUM ('PONTUAL', 'RECORRENTE');

-- AlterTable
ALTER TABLE "icps" ADD COLUMN     "averageTicketBRL" DOUBLE PRECISION,
ADD COLUMN     "saleModel" "SaleModel",
ADD COLUMN     "salesCycleLength" TEXT;

-- AlterTable
ALTER TABLE "opportunity_scores" ADD COLUMN     "decisionMakerName" TEXT;

