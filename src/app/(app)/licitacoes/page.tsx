import { requireBiddingAccess } from "@/lib/licitacoes/access";

export default async function LicitacoesPage() {
  await requireBiddingAccess();

  return (
    <div className="px-8 py-8 max-w-[960px]">
      <h1 className="text-[22px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Licitações
      </h1>
      <p className="text-[13.5px] leading-[1.6] m-0" style={{ color: "var(--fg-muted)" }}>
        Módulo em beta. As ferramentas de análise de editais estão sendo liberadas por etapas.
      </p>
    </div>
  );
}
