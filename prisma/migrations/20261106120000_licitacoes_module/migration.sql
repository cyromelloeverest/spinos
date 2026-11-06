
-- CreateEnum
CREATE TYPE "TenderStage" AS ENUM ('IDENTIFICADA', 'EM_ANALISE', 'AGUARDANDO_DECISAO', 'APROVADA', 'PREPARANDO_DOCUMENTACAO', 'PROPOSTA_PRONTA', 'PROPOSTA_ENVIADA', 'EM_JULGAMENTO', 'VENCIDA', 'PERDIDA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "TenderDocumentKind" AS ENUM ('EDITAL', 'TERMO_REFERENCIA', 'ANEXO', 'RETIFICACAO', 'ESCLARECIMENTO', 'COMPROVANTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "TextExtractionStatus" AS ENUM ('PENDENTE', 'OK', 'SEM_TEXTO', 'FALHOU');

-- CreateEnum
CREATE TYPE "TenderAnalysisStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'FALHOU');

-- CreateEnum
CREATE TYPE "TenderViabilityClass" AS ENUM ('RECOMENDADA', 'EXIGE_AVALIACAO', 'NAO_RECOMENDADA');

-- CreateEnum
CREATE TYPE "TenderDecision" AS ENUM ('PARTICIPAR', 'NAO_PARTICIPAR');

-- CreateEnum
CREATE TYPE "HabilitacaoCategory" AS ENUM ('SOCIETARIO', 'CERTIDAO', 'ECONOMICO_FINANCEIRA', 'ATESTADO', 'DECLARACAO', 'PROPOSTA_COMERCIAL', 'ANEXO_ESPECIFICO');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'PRONTO', 'NECESSITA_VALIDACAO', 'NAO_APLICAVEL');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "biddingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "bidder_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "services" TEXT[],
    "regions" TEXT[],
    "technicalCapabilities" TEXT,
    "teamAvailable" TEXT,
    "referenceCosts" JSONB,
    "minMarginPct" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidder_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidder_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "HabilitacaoCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "issuer" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "fileName" TEXT,
    "storagePath" TEXT,
    "sha256" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidder_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidder_certificates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contractingParty" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "quantities" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidder_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "editalNumber" TEXT,
    "processNumber" TEXT,
    "modality" TEXT,
    "object" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT,
    "state" TEXT,
    "scope" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "opensAt" TIMESTAMP(3),
    "questionsDeadline" TIMESTAMP(3),
    "sourcePortal" TEXT,
    "officialUrl" TEXT,
    "stage" "TenderStage" NOT NULL DEFAULT 'IDENTIFICADA',
    "stageUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibleUserId" TEXT,
    "notes" TEXT,
    "isFictitious" BOOLEAN NOT NULL DEFAULT false,
    "viabilityScores" JSONB,
    "viabilityClass" "TenderViabilityClass",
    "viabilityComputedAt" TIMESTAMP(3),
    "decision" "TenderDecision",
    "decisionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "protocolNumber" TEXT,
    "closeReason" TEXT,
    "closeNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_documents" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "TenderDocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "pageCount" INTEGER,
    "extractionStatus" "TextExtractionStatus" NOT NULL DEFAULT 'PENDENTE',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_document_pages" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "tender_document_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_analyses" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TenderAnalysisStatus" NOT NULL DEFAULT 'PENDENTE',
    "model" TEXT,
    "result" JSONB,
    "sourceCheck" JSONB,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "requestedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_checklist_items" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "HabilitacaoCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" JSONB,
    "assigneeUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "bidderDocumentId" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_cost_scenarios" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "proposalValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_cost_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_stage_events" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromStage" "TenderStage",
    "toStage" "TenderStage" NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bidder_profiles_organizationId_key" ON "bidder_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "bidder_documents_organizationId_category_idx" ON "bidder_documents"("organizationId", "category");

-- CreateIndex
CREATE INDEX "bidder_certificates_organizationId_idx" ON "bidder_certificates"("organizationId");

-- CreateIndex
CREATE INDEX "tenders_organizationId_stage_idx" ON "tenders"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "tenders_organizationId_opensAt_idx" ON "tenders"("organizationId", "opensAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_id_organizationId_key" ON "tenders"("id", "organizationId");

-- CreateIndex
CREATE INDEX "tender_documents_tenderId_idx" ON "tender_documents"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "tender_documents_id_organizationId_key" ON "tender_documents"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "tender_document_pages_documentId_page_key" ON "tender_document_pages"("documentId", "page");

-- CreateIndex
CREATE UNIQUE INDEX "tender_analyses_tenderId_version_key" ON "tender_analyses"("tenderId", "version");

-- CreateIndex
CREATE INDEX "tender_checklist_items_tenderId_idx" ON "tender_checklist_items"("tenderId");

-- CreateIndex
CREATE INDEX "tender_cost_scenarios_tenderId_idx" ON "tender_cost_scenarios"("tenderId");

-- CreateIndex
CREATE INDEX "tender_stage_events_tenderId_createdAt_idx" ON "tender_stage_events"("tenderId", "createdAt");

-- AddForeignKey
ALTER TABLE "bidder_profiles" ADD CONSTRAINT "bidder_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_documents" ADD CONSTRAINT "bidder_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_certificates" ADD CONSTRAINT "bidder_certificates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_certificates" ADD CONSTRAINT "bidder_certificates_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "bidder_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_documents" ADD CONSTRAINT "tender_documents_tenderId_organizationId_fkey" FOREIGN KEY ("tenderId", "organizationId") REFERENCES "tenders"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_document_pages" ADD CONSTRAINT "tender_document_pages_documentId_organizationId_fkey" FOREIGN KEY ("documentId", "organizationId") REFERENCES "tender_documents"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_analyses" ADD CONSTRAINT "tender_analyses_tenderId_organizationId_fkey" FOREIGN KEY ("tenderId", "organizationId") REFERENCES "tenders"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_checklist_items" ADD CONSTRAINT "tender_checklist_items_tenderId_organizationId_fkey" FOREIGN KEY ("tenderId", "organizationId") REFERENCES "tenders"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_checklist_items" ADD CONSTRAINT "tender_checklist_items_bidderDocumentId_fkey" FOREIGN KEY ("bidderDocumentId") REFERENCES "bidder_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_cost_scenarios" ADD CONSTRAINT "tender_cost_scenarios_tenderId_organizationId_fkey" FOREIGN KEY ("tenderId", "organizationId") REFERENCES "tenders"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_stage_events" ADD CONSTRAINT "tender_stage_events_tenderId_organizationId_fkey" FOREIGN KEY ("tenderId", "organizationId") REFERENCES "tenders"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- RLS: mesmo padrão de todas as tabelas de tenant (tenant_isolation).
-- Defesa em profundidade — a FK composta (tenderId, organizationId) já
-- impede filho apontando pra licitação de outra organização.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bidder_profiles','bidder_documents','bidder_certificates','tenders',
    'tender_documents','tender_document_pages','tender_analyses',
    'tender_checklist_items','tender_cost_scenarios','tender_stage_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.current_org_id'', true)) WITH CHECK ("organizationId" = current_setting(''app.current_org_id'', true))',
      t);
  END LOOP;
END $$;

-- ============================================================
-- Bucket privado para editais e documentos de habilitação.
-- Sem policies em storage.objects para anon/authenticated = acesso negado
-- por padrão; só o servidor (chave secreta) gera URLs assinadas.
-- Pastas por organização: <organizationId>/...
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('licitacoes', 'licitacoes', false, 52428800, ARRAY['application/pdf'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
