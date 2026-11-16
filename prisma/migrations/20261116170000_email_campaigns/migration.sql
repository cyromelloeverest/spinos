-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'CANCELED');

-- CreateEnum
CREATE TYPE "EmailMessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('UNSUBSCRIBE', 'BOUNCE', 'COMPLAINT', 'MANUAL');

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "htmlSnapshot" TEXT,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "startedByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "status" "EmailMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_campaigns_organizationId_status_idx" ON "email_campaigns"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "email_campaigns_id_organizationId_key" ON "email_campaigns"("id", "organizationId");

-- CreateIndex
CREATE INDEX "email_messages_organizationId_status_sentAt_idx" ON "email_messages"("organizationId", "status", "sentAt");

-- CreateIndex
CREATE INDEX "email_messages_providerId_idx" ON "email_messages"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_campaignId_email_key" ON "email_messages"("campaignId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "email_suppressions_organizationId_email_key" ON "email_suppressions"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_campaignId_organizationId_fkey" FOREIGN KEY ("campaignId", "organizationId") REFERENCES "email_campaigns"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: mesmo padrão das demais tabelas de cliente.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_campaigns','email_messages','email_suppressions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.current_org_id'', true)) WITH CHECK ("organizationId" = current_setting(''app.current_org_id'', true))',
      t);
  END LOOP;
END $$;
