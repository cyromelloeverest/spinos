-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PROFISSIONAL', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'STARTER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
