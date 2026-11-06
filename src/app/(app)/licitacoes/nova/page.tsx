import Link from "next/link";
import { requireBiddingAccess } from "@/lib/licitacoes/access";
import { createTender } from "@/lib/actions/licitacoes-tender";
import { TenderForm } from "@/components/TenderForm";
import { ChevronLeft } from "lucide-react";

export default async function NovaLicitacaoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireBiddingAccess();
  const { error } = await searchParams;

  return (
    <div className="pt-10 px-4 md:px-10 pb-16 max-w-[760px]">
      <Link href="/licitacoes" className="inline-flex items-center gap-1 text-[12.5px] no-underline mb-4" style={{ color: "var(--fg-muted)" }}>
        <ChevronLeft size={14} strokeWidth={1.75} /> Licitações
      </Link>
      <h1 className="text-[25px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Nova licitação
      </h1>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Cadastre os dados principais. Depois você anexa o edital e os demais documentos.
      </p>
      {error && (
        <div className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
          {error}
        </div>
      )}
      <TenderForm action={createTender} submitLabel="Criar licitação" />
    </div>
  );
}
