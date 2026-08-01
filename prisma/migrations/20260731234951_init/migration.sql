-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SignalCategory" AS ENUM ('HIRING', 'EXPANSION', 'FUNDING', 'TECHNOLOGY', 'MARKETING', 'LEADERSHIP_CHANGE', 'PROCUREMENT', 'REGULATORY', 'PARTNERSHIP', 'AWARD', 'EVENT', 'ICP_MATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('NEW', 'REVIEWED', 'CONTACTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

-- CreateEnum
CREATE TYPE "FeedbackOutcome" AS ENUM ('CONTACTED', 'MEETING_BOOKED', 'PROPOSAL_SENT', 'CONVERTED', 'NOT_INTERESTED', 'WRONG_FIT', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "site" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "segment" TEXT,
    "employeeRange" TEXT,
    "revenueRange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icps" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'ICP Principal',
    "segments" TEXT[],
    "employeeMin" INTEGER,
    "employeeMax" INTEGER,
    "revenueMin" DOUBLE PRECISION,
    "revenueMax" DOUBLE PRECISION,
    "states" TEXT[],
    "cities" TEXT[],
    "decisionMakerTitles" TEXT[],
    "technologies" TEXT[],
    "keywords" TEXT[],
    "productsSold" TEXT[],
    "servicesSold" TEXT[],
    "radiusKm" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "site" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "segment" TEXT,
    "employeeRange" TEXT,
    "revenueRange" TEXT,
    "foundedYear" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" "SignalCategory" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "rawData" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_scores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "icpId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "headline" TEXT NOT NULL,
    "execSummary" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "buyerArea" TEXT,
    "decisionMaker" TEXT,
    "suggestedApproach" TEXT NOT NULL,
    "commercialArguments" TEXT[],
    "objections" TEXT[],
    "status" "OpportunityStatus" NOT NULL DEFAULT 'NEW',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_score_signals" (
    "id" TEXT NOT NULL,
    "opportunityScoreId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,

    CONSTRAINT "opportunity_score_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "opportunityScoreId" TEXT NOT NULL,
    "outcome" "FeedbackOutcome" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_exports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityScoreId" TEXT NOT NULL,
    "crmProvider" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'success',

    CONSTRAINT "crm_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_cnpj_key" ON "companies"("cnpj");

-- CreateIndex
CREATE INDEX "companies_state_city_idx" ON "companies"("state", "city");

-- CreateIndex
CREATE INDEX "companies_segment_idx" ON "companies"("segment");

-- CreateIndex
CREATE INDEX "signals_companyId_detectedAt_idx" ON "signals"("companyId", "detectedAt");

-- CreateIndex
CREATE INDEX "signals_category_idx" ON "signals"("category");

-- CreateIndex
CREATE INDEX "opportunity_scores_organizationId_score_idx" ON "opportunity_scores"("organizationId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_scores_organizationId_companyId_icpId_key" ON "opportunity_scores"("organizationId", "companyId", "icpId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_score_signals_opportunityScoreId_signalId_key" ON "opportunity_score_signals"("opportunityScoreId", "signalId");

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_opportunityScoreId_key" ON "feedbacks"("opportunityScoreId");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icps" ADD CONSTRAINT "icps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_icpId_fkey" FOREIGN KEY ("icpId") REFERENCES "icps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_score_signals" ADD CONSTRAINT "opportunity_score_signals_opportunityScoreId_fkey" FOREIGN KEY ("opportunityScoreId") REFERENCES "opportunity_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_score_signals" ADD CONSTRAINT "opportunity_score_signals_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_opportunityScoreId_fkey" FOREIGN KEY ("opportunityScoreId") REFERENCES "opportunity_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_exports" ADD CONSTRAINT "crm_exports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_exports" ADD CONSTRAINT "crm_exports_opportunityScoreId_fkey" FOREIGN KEY ("opportunityScoreId") REFERENCES "opportunity_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
