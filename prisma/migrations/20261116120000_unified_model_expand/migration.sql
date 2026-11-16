
-- CreateEnum
CREATE TYPE "AccountLifecycle" AS ENUM ('TARGET', 'ENGAGED', 'CUSTOMER', 'LOST', 'DISMISSED');

-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'LINKEDIN', 'MEETING', 'PROPOSAL', 'TASK', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('OPEN', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "OriginKind" AS ENUM ('PROSPECTING', 'LANDING_PAGE', 'AD', 'REFERRAL', 'MANUAL', 'IMPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignKind" AS ENUM ('AD', 'EMAIL', 'OUTBOUND', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LegalBasis" AS ENUM ('LEGITIMATE_INTEREST', 'CONSENT', 'CONTRACT');

-- AlterTable
ALTER TABLE "opportunity_scores" ADD COLUMN     "accountId" TEXT;

-- CreateTable
CREATE TABLE "organization_packs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packKey" TEXT NOT NULL,
    "packVersion" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "StageKind" NOT NULL DEFAULT 'OPEN',
    "targetPct" DOUBLE PRECISION,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loss_reasons" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "loss_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "CampaignKind" NOT NULL,
    "channel" TEXT,
    "name" TEXT NOT NULL,
    "externalRef" TEXT,
    "spendBRL" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "site" TEXT,
    "city" TEXT,
    "state" TEXT,
    "segment" TEXT,
    "lifecycle" "AccountLifecycle" NOT NULL DEFAULT 'TARGET',
    "ownerUserId" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "decisionRole" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phoneE164" TEXT,
    "linkedinUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "legalBasis" "LegalBasis",
    "legalBasisNote" TEXT,
    "optedOutAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "primaryContactId" TEXT,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "expectedValueBRL" DOUBLE PRECISION,
    "wonValueBRL" DOUBLE PRECISION,
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "lossReasonId" TEXT,
    "lossNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextActivityAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "campaignId" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "lastActionByUserId" TEXT,
    "lastActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stage_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "accountId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "ownerUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "status" "ActivityStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" TEXT,
    "notes" TEXT,
    "cadenceId" TEXT,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origins" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "OriginKind" NOT NULL,
    "channel" TEXT,
    "campaignId" TEXT,
    "landingPageId" TEXT,
    "accountId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "isFirstTouch" BOOLEAN NOT NULL DEFAULT false,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "gclid" TEXT,
    "fbclid" TEXT,
    "referrerHost" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "origins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_packs_organizationId_key" ON "organization_packs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_id_organizationId_key" ON "pipelines"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "stages_id_organizationId_key" ON "stages"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "stages_pipelineId_key_key" ON "stages"("pipelineId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "loss_reasons_id_organizationId_key" ON "loss_reasons"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "loss_reasons_organizationId_key_key" ON "loss_reasons"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_id_organizationId_key" ON "campaigns"("id", "organizationId");

-- CreateIndex
CREATE INDEX "accounts_organizationId_lifecycle_idx" ON "accounts"("organizationId", "lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_id_organizationId_key" ON "accounts"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_organizationId_companyId_key" ON "accounts"("organizationId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_organizationId_cnpj_key" ON "accounts"("organizationId", "cnpj");

-- CreateIndex
CREATE INDEX "contacts_organizationId_accountId_idx" ON "contacts"("organizationId", "accountId");

-- CreateIndex
CREATE INDEX "contacts_organizationId_phoneE164_idx" ON "contacts"("organizationId", "phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_id_organizationId_key" ON "contacts"("id", "organizationId");

-- CreateIndex
CREATE INDEX "opportunities_organizationId_status_stageId_idx" ON "opportunities"("organizationId", "status", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_id_organizationId_key" ON "opportunities"("id", "organizationId");

-- CreateIndex
CREATE INDEX "opportunity_stage_events_opportunityId_createdAt_idx" ON "opportunity_stage_events"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "activities_organizationId_status_dueAt_idx" ON "activities"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "activities_organizationId_clientRequestId_key" ON "activities"("organizationId", "clientRequestId");

-- CreateIndex
CREATE INDEX "origins_organizationId_accountId_idx" ON "origins"("organizationId", "accountId");

-- CreateIndex
CREATE INDEX "origins_organizationId_kind_occurredAt_idx" ON "origins"("organizationId", "kind", "occurredAt");

-- AddForeignKey
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_packs" ADD CONSTRAINT "organization_packs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_pipelineId_organizationId_fkey" FOREIGN KEY ("pipelineId", "organizationId") REFERENCES "pipelines"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_reasons" ADD CONSTRAINT "loss_reasons_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_accountId_organizationId_fkey" FOREIGN KEY ("accountId", "organizationId") REFERENCES "accounts"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_accountId_organizationId_fkey" FOREIGN KEY ("accountId", "organizationId") REFERENCES "accounts"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_primaryContactId_organizationId_fkey" FOREIGN KEY ("primaryContactId", "organizationId") REFERENCES "contacts"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_pipelineId_organizationId_fkey" FOREIGN KEY ("pipelineId", "organizationId") REFERENCES "pipelines"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_stageId_organizationId_fkey" FOREIGN KEY ("stageId", "organizationId") REFERENCES "stages"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lossReasonId_organizationId_fkey" FOREIGN KEY ("lossReasonId", "organizationId") REFERENCES "loss_reasons"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_campaignId_organizationId_fkey" FOREIGN KEY ("campaignId", "organizationId") REFERENCES "campaigns"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_events" ADD CONSTRAINT "opportunity_stage_events_opportunityId_organizationId_fkey" FOREIGN KEY ("opportunityId", "organizationId") REFERENCES "opportunities"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_events" ADD CONSTRAINT "opportunity_stage_events_toStageId_organizationId_fkey" FOREIGN KEY ("toStageId", "organizationId") REFERENCES "stages"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_accountId_organizationId_fkey" FOREIGN KEY ("accountId", "organizationId") REFERENCES "accounts"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contactId_organizationId_fkey" FOREIGN KEY ("contactId", "organizationId") REFERENCES "contacts"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunityId_organizationId_fkey" FOREIGN KEY ("opportunityId", "organizationId") REFERENCES "opportunities"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origins" ADD CONSTRAINT "origins_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origins" ADD CONSTRAINT "origins_campaignId_organizationId_fkey" FOREIGN KEY ("campaignId", "organizationId") REFERENCES "campaigns"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origins" ADD CONSTRAINT "origins_accountId_organizationId_fkey" FOREIGN KEY ("accountId", "organizationId") REFERENCES "accounts"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origins" ADD CONSTRAINT "origins_contactId_organizationId_fkey" FOREIGN KEY ("contactId", "organizationId") REFERENCES "contacts"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origins" ADD CONSTRAINT "origins_opportunityId_organizationId_fkey" FOREIGN KEY ("opportunityId", "organizationId") REFERENCES "opportunities"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- RLS: mesmo padrão de todas as tabelas de cliente (tenant_isolation).
-- Defesa em profundidade além das chaves compostas (id, organizationId).
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_packs','pipelines','stages','loss_reasons','campaigns',
    'accounts','contacts','opportunities','opportunity_stage_events',
    'activities','origins'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.current_org_id'', true)) WITH CHECK ("organizationId" = current_setting(''app.current_org_id'', true))',
      t);
  END LOOP;
END $$;
