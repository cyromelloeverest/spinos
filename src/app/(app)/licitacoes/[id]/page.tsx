import Link from "next/link";
import { notFound } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { requireBiddingAccess } from "@/lib/licitacoes/access";
import { updateTender, deleteTender } from "@/lib/actions/licitacoes-tender";
import { TENDER_STAGE_LABEL, TENDER_DOCUMENT_KIND_LABEL } from "@/lib/licitacoes/stages";
import { TenderForm } from "@/components/TenderForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { TenderUpload } from "@/components/TenderUpload";
import { TenderDocumentActions } from "@/components/TenderDocumentRow";
import { ChevronLeft } from "lucide-react";

// Upload + extração de texto rodam em Server Actions desta página.
export const maxDuration = 120;

const EXTRACTION_LABEL = { PENDENTE: "Aguardando", OK: "Texto extraído", SEM_TEXTO: "Sem texto (PDF escaneado?)", FALHOU: "Falha na leitura" } as const;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function LicitacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { organizationId } = await requireBiddingAccess();
  const { id } = await params;
  const query = await searchParams;

  const tender = await withOrgContext(organizationId, (tx) =>
    tx.tender.findFirst({ where: { id, organizationId }, include: { documents: { orderBy: { createdAt: "asc" } } } }),
  );
  if (!tender) notFound();

  return (
    <div className="pt-10 px-4 md:px-10 pb-16 max-w-[760px]">
      <Link href="/licitacoes" className="inline-flex items-center gap-1 text-[12.5px] no-underline mb-4" style={{ color: "var(--fg-muted)" }}>
        <ChevronLeft size={14} strokeWidth={1.75} /> Licitações
      </Link>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-[25px] font-medium m-0" style={{ fontFamily: "var(--font-display)" }}>
          {tender.agency}
        </h1>
        <span className="text-[11px] font-medium px-2 py-1 rounded-[8px] border flex-shrink-0 mt-1.5" style={{ borderColor: "var(--border-strong)", color: "var(--fg-muted)" }}>
          {TENDER_STAGE_LABEL[tender.stage]}
        </span>
      </div>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        {tender.editalNumber ? `Edital ${tender.editalNumber}` : "Sem número de edital informado"}
      </p>

      {query.saved && (
        <div className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
          Alterações salvas.
        </div>
      )}
      {query.error && (
        <div className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
          {query.error}
        </div>
      )}

      <section className="mb-10">
        <h2 className="text-[15px] font-semibold m-0 mb-3">Documentos</h2>
        {tender.documents.length > 0 && (
          <div className="rounded-[12px] border overflow-hidden mb-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {tender.documents.map((d, i) => (
              <div key={d.id} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium break-words">{d.fileName}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                    {TENDER_DOCUMENT_KIND_LABEL[d.kind]} · {d.pageCount ?? "?"} página(s) · {formatSize(d.sizeBytes)} ·{" "}
                    <span style={{ color: d.extractionStatus === "OK" ? "var(--primary)" : "var(--warn)" }}>{EXTRACTION_LABEL[d.extractionStatus]}</span>
                  </div>
                </div>
                <TenderDocumentActions tenderId={tender.id} documentId={d.id} fileName={d.fileName} />
              </div>
            ))}
          </div>
        )}
        <TenderUpload tenderId={tender.id} />
      </section>

      <section className="mb-10">
        <h2 className="text-[15px] font-semibold m-0 mb-3">Dados da licitação</h2>
        <TenderForm action={updateTender.bind(null, tender.id)} values={tender} submitLabel="Salvar alterações" />
      </section>

      <section>
        <h2 className="text-[15px] font-semibold m-0 mb-2" style={{ color: "var(--critical)" }}>
          Excluir licitação
        </h2>
        <p className="text-[12.5px] m-0 mb-3" style={{ color: "var(--fg-muted)" }}>
          Apaga a licitação, os arquivos enviados e o texto extraído. Não dá para desfazer.
        </p>
        <form action={deleteTender.bind(null, tender.id)}>
          <ConfirmSubmitButton message="Excluir esta licitação, os arquivos e o texto extraído? Não dá para desfazer." style={{ background: "var(--card)", borderColor: "var(--critical)", color: "var(--critical)" }}>
            Excluir licitação
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
