
-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "lifecycleEmailsOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staleOpportunitiesEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "trialEndingEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "trialNoSearchEmailSentAt" TIMESTAMP(3);

