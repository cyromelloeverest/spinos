-- AlterEnum
ALTER TYPE "EmailMessageStatus" ADD VALUE 'SENDING';

-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "claimedAt" TIMESTAMP(3);

