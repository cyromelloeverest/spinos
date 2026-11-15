-- Remoção do módulo Licitações (decisão de 2026-11-15, plano de unificação).
-- Conferido antes: as 10 tabelas, o bucket e o log de auditoria estavam vazios.
-- O bucket privado 'licitacoes' (vazio) não é apagado aqui: o Supabase bloqueia
-- DELETE direto em storage.buckets. Apagar pelo painel Storage.

-- DropForeignKey
ALTER TABLE "bidder_certificates" DROP CONSTRAINT "bidder_certificates_documentId_fkey";

-- DropForeignKey
ALTER TABLE "bidder_certificates" DROP CONSTRAINT "bidder_certificates_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "bidder_documents" DROP CONSTRAINT "bidder_documents_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "bidder_profiles" DROP CONSTRAINT "bidder_profiles_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "tender_analyses" DROP CONSTRAINT "tender_analyses_tenderId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "tender_checklist_items" DROP CONSTRAINT "tender_checklist_items_bidderDocumentId_fkey";

-- DropForeignKey
ALTER TABLE "tender_checklist_items" DROP CONSTRAINT "tender_checklist_items_tenderId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "tender_cost_scenarios" DROP CONSTRAINT "tender_cost_scenarios_tenderId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "tender_document_pages" DROP CONSTRAINT "tender_document_pages_documentId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "tender_documents" DROP CONSTRAINT "tender_documents_tenderId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "tender_stage_events" DROP CONSTRAINT "tender_stage_events_tenderId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "tenders" DROP CONSTRAINT "tenders_organizationId_fkey";

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "biddingEnabled";

-- DropTable
DROP TABLE "bidder_certificates";

-- DropTable
DROP TABLE "bidder_documents";

-- DropTable
DROP TABLE "bidder_profiles";

-- DropTable
DROP TABLE "tender_analyses";

-- DropTable
DROP TABLE "tender_checklist_items";

-- DropTable
DROP TABLE "tender_cost_scenarios";

-- DropTable
DROP TABLE "tender_document_pages";

-- DropTable
DROP TABLE "tender_documents";

-- DropTable
DROP TABLE "tender_stage_events";

-- DropTable
DROP TABLE "tenders";

-- DropEnum
DROP TYPE "ChecklistItemStatus";

-- DropEnum
DROP TYPE "HabilitacaoCategory";

-- DropEnum
DROP TYPE "TenderAnalysisStatus";

-- DropEnum
DROP TYPE "TenderDecision";

-- DropEnum
DROP TYPE "TenderDocumentKind";

-- DropEnum
DROP TYPE "TenderStage";

-- DropEnum
DROP TYPE "TenderViabilityClass";

-- DropEnum
DROP TYPE "TextExtractionStatus";

