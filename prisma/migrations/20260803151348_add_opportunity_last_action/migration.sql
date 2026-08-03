-- AlterTable
ALTER TABLE "opportunity_scores" ADD COLUMN     "lastActionAt" TIMESTAMP(3),
ADD COLUMN     "lastActionByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_lastActionByUserId_fkey" FOREIGN KEY ("lastActionByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
