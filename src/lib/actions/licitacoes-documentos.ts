"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { withOrgContext } from "@/lib/db/with-org-context";
import { requireBiddingAccess } from "@/lib/licitacoes/access";
import { logSecurityEvent } from "@/lib/audit/log";
import { createSupabaseAdminClient, LICITACOES_BUCKET } from "@/lib/supabase/admin";
import {
  MAX_PDF_BYTES,
  MAX_DOCUMENTS_PER_TENDER,
  validatePdfBytes,
  sha256Hex,
  sanitizeFileName,
  buildStoragePath,
  isOwnStoragePath,
  extractPdfPages,
} from "@/lib/licitacoes/pdf";
import type { TenderDocumentKind } from "@/generated/prisma/enums";

const KINDS: TenderDocumentKind[] = ["EDITAL", "TERMO_REFERENCIA", "ANEXO", "RETIFICACAO", "ESCLARECIMENTO", "COMPROVANTE", "OUTRO"];

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Passo 1: o navegador pede um endereço assinado de upload. O arquivo vai
// DIRETO do navegador pro Storage (não passa pelo limite de corpo da função).
// O token vale só pra esse caminho exato, dentro da pasta da organização.
export async function requestTenderUpload(tenderId: string, sizeBytes: number): Promise<Result<{ path: string; token: string }>> {
  const { organizationId } = await requireBiddingAccess();

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { ok: false, error: "Arquivo inválido." };
  if (sizeBytes > MAX_PDF_BYTES) return { ok: false, error: "O arquivo passa de 50 MB." };

  const count = await withOrgContext(organizationId, async (tx) => {
    const tender = await tx.tender.findFirst({ where: { id: tenderId, organizationId }, select: { id: true } });
    if (!tender) return null;
    return tx.tenderDocument.count({ where: { tenderId, organizationId } });
  });
  if (count === null) return { ok: false, error: "Licitação não encontrada." };
  if (count >= MAX_DOCUMENTS_PER_TENDER) return { ok: false, error: `Limite de ${MAX_DOCUMENTS_PER_TENDER} documentos por licitação.` };

  const path = buildStoragePath(organizationId, tenderId, randomUUID());
  const { data, error } = await createSupabaseAdminClient().storage.from(LICITACOES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Não foi possível iniciar o envio. Tente novamente." };
  return { ok: true, path, token: data.token };
}

// Passo 2: depois do upload, o SERVIDOR baixa o arquivo e valida o conteúdo
// (assinatura PDF, tamanho real), calcula o hash, extrai o texto por página e
// só então registra. Qualquer falha apaga o arquivo do Storage.
export async function finalizeTenderUpload(tenderId: string, path: string, fileName: string, kind: string): Promise<Result<{ extraction: string; pageCount: number | null }>> {
  const { organizationId, userId } = await requireBiddingAccess();

  if (!isOwnStoragePath(path, organizationId, tenderId)) return { ok: false, error: "Caminho de arquivo inválido." };
  if (!(KINDS as string[]).includes(kind)) return { ok: false, error: "Tipo de documento inválido." };

  const storage = createSupabaseAdminClient().storage.from(LICITACOES_BUCKET);
  const reject = async (error: string, reason: string): Promise<Result<never>> => {
    await storage.remove([path]);
    await logSecurityEvent({ type: "licitacoes.document_rejected", actorUserId: userId, organizationId, targetId: tenderId, metadata: { reason } });
    return { ok: false, error };
  };

  const tender = await withOrgContext(organizationId, (tx) => tx.tender.findFirst({ where: { id: tenderId, organizationId }, select: { id: true } }));
  if (!tender) {
    await storage.remove([path]);
    return { ok: false, error: "Licitação não encontrada." };
  }
  const already = await withOrgContext(organizationId, (tx) => tx.tenderDocument.findFirst({ where: { storagePath: path, organizationId }, select: { id: true } }));
  if (already) return { ok: false, error: "Arquivo já registrado." };

  const { data: blob, error: downloadError } = await storage.download(path);
  if (downloadError || !blob) return { ok: false, error: "O envio não foi concluído. Tente novamente." };
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const check = validatePdfBytes(bytes);
  if (!check.ok) return reject(check.error, "invalid_pdf");

  const sha256 = sha256Hex(bytes);
  const duplicate = await withOrgContext(organizationId, (tx) => tx.tenderDocument.findFirst({ where: { tenderId, organizationId, sha256 }, select: { fileName: true } }));
  if (duplicate) return reject(`Esse arquivo já foi enviado nesta licitação (${duplicate.fileName}).`, "duplicate");

  const extracted = await extractPdfPages(bytes);
  if (!extracted.ok) return reject(extracted.error, "unreadable");

  const doc = await withOrgContext(organizationId, async (tx) => {
    const created = await tx.tenderDocument.create({
      data: {
        tenderId,
        organizationId,
        kind: kind as TenderDocumentKind,
        fileName: sanitizeFileName(fileName),
        storagePath: path,
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
        sha256,
        pageCount: extracted.pageCount,
        extractionStatus: extracted.status,
        uploadedById: userId,
      },
    });
    await tx.tenderDocumentPage.createMany({
      data: extracted.pages.map((text, i) => ({ documentId: created.id, organizationId, page: i + 1, text })),
    });
    return created;
  });

  await logSecurityEvent({ type: "licitacoes.document_uploaded", actorUserId: userId, organizationId, targetId: doc.id, metadata: { tenderId, kind, sizeBytes: bytes.byteLength, sha256 } });
  revalidatePath(`/licitacoes/${tenderId}`);
  return { ok: true, extraction: extracted.status, pageCount: extracted.pageCount };
}

export async function removeTenderDocument(tenderId: string, documentId: string): Promise<Result> {
  const { organizationId, userId } = await requireBiddingAccess();

  const doc = await withOrgContext(organizationId, (tx) => tx.tenderDocument.findFirst({ where: { id: documentId, tenderId, organizationId } }));
  if (!doc) return { ok: false, error: "Documento não encontrado." };

  const { error } = await createSupabaseAdminClient().storage.from(LICITACOES_BUCKET).remove([doc.storagePath]);
  if (error) return { ok: false, error: "Não foi possível apagar o arquivo. Tente novamente." };
  await withOrgContext(organizationId, (tx) => tx.tenderDocument.deleteMany({ where: { id: documentId, organizationId } }));

  await logSecurityEvent({ type: "licitacoes.document_removed", actorUserId: userId, organizationId, targetId: documentId, metadata: { tenderId } });
  revalidatePath(`/licitacoes/${tenderId}`);
  return { ok: true };
}
