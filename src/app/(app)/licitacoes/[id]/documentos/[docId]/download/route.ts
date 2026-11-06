import { NextResponse } from "next/server";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentMembership } from "@/lib/auth/current-org";
import { prismaAdmin } from "@/lib/prisma-admin";
import { isBiddingEnabled } from "@/lib/licitacoes/gating";
import { createSupabaseAdminClient, LICITACOES_BUCKET } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/lib/audit/log";

// Download = checa sessão + acesso ao módulo + que o documento é da
// organização, e só então devolve um redirect pra URL assinada de 60s. O
// bucket é privado: não existe link permanente.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const membership = await getCurrentMembership();
  if (!membership) return new NextResponse("Não autorizado", { status: 401 });

  const org = await prismaAdmin.organization.findUnique({ where: { id: membership.organizationId }, select: { plan: true, biddingEnabled: true } });
  if (!org || !isBiddingEnabled(org)) return new NextResponse("Não encontrado", { status: 404 });

  const organizationId = membership.organizationId;
  const doc = await withOrgContext(organizationId, (tx) => tx.tenderDocument.findFirst({ where: { id: docId, tenderId: id, organizationId } }));
  if (!doc) return new NextResponse("Não encontrado", { status: 404 });

  const { data, error } = await createSupabaseAdminClient().storage.from(LICITACOES_BUCKET).createSignedUrl(doc.storagePath, 60, { download: doc.fileName });
  if (error || !data) return new NextResponse("Não foi possível gerar o link", { status: 502 });

  await logSecurityEvent({ type: "licitacoes.document_downloaded", actorUserId: membership.userId, organizationId, targetId: doc.id });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
