import Link from "next/link";
import { withOrgContext } from "@/lib/db/with-org-context";
import { requireBiddingAccess } from "@/lib/licitacoes/access";
import { TENDER_STAGE_LABEL } from "@/lib/licitacoes/stages";
import { formatBRL, formatBrasilia } from "@/lib/licitacoes/tender-input";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { logError } from "@/lib/log-error";
import { Plus } from "lucide-react";

export default async function LicitacoesPage() {
  const { organizationId } = await requireBiddingAccess();

  let tenders;
  try {
    tenders = await withOrgContext(organizationId, (tx) =>
      tx.tender.findMany({
        where: { organizationId },
        orderBy: [{ opensAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        include: { _count: { select: { documents: true } } },
      }),
    );
  } catch (err) {
    logError("licitacoes: falha ao listar", err, { organizationId });
    return <DbSetupNotice />;
  }

  return (
    <div className="pt-10 px-4 md:px-10 pb-16 max-w-[960px]">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[25px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Licitações
          </h1>
          <p className="m-0 text-[13.5px] leading-[1.6]" style={{ color: "var(--fg-muted)" }}>
            Módulo em beta. A análise de editais apoia a decisão, mas não substitui a leitura do edital nem a revisão jurídica.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/licitacoes/perfil" className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border no-underline" style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}>
            Perfil de habilitação
          </Link>
          <Link href="/licitacoes/nova" className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-[10px] no-underline" style={{ background: "var(--primary)", color: "#ffffff" }}>
            <Plus size={14} strokeWidth={2} /> Nova licitação
          </Link>
        </div>
      </div>

      {tenders.length === 0 ? (
        <p className="text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          Nenhuma licitação cadastrada ainda.
        </p>
      ) : (
        <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {tenders.map((t, i) => (
            <Link key={t.id} href={`/licitacoes/${t.id}`} className="block px-4 py-3 no-underline" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)", color: "var(--fg)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium truncate">
                    {t.agency}
                    {t.editalNumber ? ` · ${t.editalNumber}` : ""}
                    {t.isFictitious && (
                      <span className="ml-2 text-[10px] font-semibold uppercase rounded-full px-1.5 py-[1px]" style={{ background: "var(--warn)", color: "#ffffff" }}>
                        Fictício
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] mt-0.5 line-clamp-2" style={{ color: "var(--fg-muted)" }}>
                    {t.object}
                  </div>
                  <div className="text-[11.5px] mt-1" style={{ color: "var(--fg-faint)" }}>
                    Abertura {formatBrasilia(t.opensAt)} · {formatBRL(t.estimatedValue)} · {t._count.documents} documento(s)
                  </div>
                </div>
                <span className="text-[11px] font-medium px-2 py-1 rounded-[8px] border flex-shrink-0" style={{ borderColor: "var(--border-strong)", color: "var(--fg-muted)" }}>
                  {TENDER_STAGE_LABEL[t.stage]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
