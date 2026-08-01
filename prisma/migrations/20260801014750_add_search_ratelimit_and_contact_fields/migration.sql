-- AlterTable
ALTER TABLE "opportunity_scores" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "recommendedOffering" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "lastSearchAt" TIMESTAMP(3);
