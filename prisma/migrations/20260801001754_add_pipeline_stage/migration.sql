-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('CONTATO_FEITO', 'VISITA_AGENDADA', 'PROPOSTA_ENVIADA', 'VENDIDO', 'PERDIDO');

-- AlterTable
ALTER TABLE "opportunity_scores" ADD COLUMN     "stage" "PipelineStage",
ADD COLUMN     "stageUpdatedAt" TIMESTAMP(3);
