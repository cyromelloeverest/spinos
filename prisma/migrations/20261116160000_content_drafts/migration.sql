-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('IDEA', 'SOCIAL_POST', 'ARTICLE', 'EMAIL');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'APPROVED', 'DISCARDED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "professionalRegistration" TEXT,
ADD COLUMN     "responsibleName" TEXT;

-- CreateTable
CREATE TABLE "content_drafts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" TEXT,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "toVerify" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "packKey" TEXT,
    "packVersion" TEXT,
    "usedCredit" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_drafts_organizationId_createdAt_idx" ON "content_drafts"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "content_drafts_organizationId_generationId_idx" ON "content_drafts"("organizationId", "generationId");

-- AddForeignKey
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: mesmo padrão das demais tabelas de cliente.
ALTER TABLE "content_drafts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "content_drafts"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
