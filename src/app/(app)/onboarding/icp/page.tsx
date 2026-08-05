import { createICP } from "@/lib/actions/onboarding";
import { FormField } from "@/components/FormField";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { ArrowRight } from "lucide-react";

export default async function OnboardingICPPage({
  searchParams,
}: {
  searchParams: Promise<{ dbError?: string }>;
}) {
  const params = await searchParams;
  if (params.dbError) return <DbSetupNotice />;

  return (
    <div className="pt-10 px-4 md:px-10 pb-16 max-w-[560px]">
      <div
        className="text-[11px] uppercase mb-2"
        style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}
      >
        Passo 2 de 2
      </div>
      <h1
        className="text-[25px] font-medium m-0 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Qual é o seu cliente ideal?
      </h1>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Não precisa cadastrar concorrentes ou empresas específicas — a IA descobre automaticamente.
        Você só define o perfil.
      </p>

      <form action={createICP} className="flex flex-col gap-4">
        <FormField
          label="Segmentos-alvo"
          name="segments"
          placeholder="Ex: Metalúrgica, Fabricante de equipamentos"
          hint="separados por vírgula"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Funcionários — mínimo" name="employeeMin" placeholder="Ex: 50" />
          <FormField label="Funcionários — máximo" name="employeeMax" placeholder="Ex: 500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Estados" name="states" placeholder="Ex: SP, MG" hint="separados por vírgula" />
          <FormField label="Cidades prioritárias" name="cities" placeholder="Ex: Campinas, Piracicaba" hint="separadas por vírgula" />
        </div>
        <FormField label="Raio de atuação (km)" name="radiusKm" placeholder="Ex: 70" />
        <FormField
          label="Cargo do decisor"
          name="decisionMakerTitles"
          placeholder="Ex: Diretor Industrial, Gerente de Compras"
          hint="separados por vírgula"
        />
        <FormField
          label="Tecnologias utilizadas pelo cliente ideal"
          name="technologies"
          placeholder="Ex: SAP, ERP TOTVS"
          hint="separadas por vírgula, opcional"
        />
        <FormField
          label="Palavras-chave"
          name="keywords"
          placeholder="Ex: estruturas metálicas, corte sob medida"
          hint="separadas por vírgula"
        />
        <FormField
          label="Produtos que você vende"
          name="productsSold"
          placeholder="Ex: peças usinadas, chapas cortadas a laser"
          hint="separados por vírgula"
        />
        <FormField
          label="Serviços que você vende"
          name="servicesSold"
          placeholder="Ex: usinagem, metalização, caldeiraria, corte a laser"
          hint="separados por vírgula"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Ticket médio (R$)" name="averageTicketBRL" placeholder="Ex: 5000" hint="opcional — ajuda a IA a calibrar porte" />
          <FormField label="Ciclo de vendas típico" name="salesCycleLength" placeholder="Ex: 2 a 4 semanas" hint="opcional" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
            Modelo de venda
          </span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--fg)" }}>
              <input type="radio" name="saleModel" value="PONTUAL" className="w-4 h-4" style={{ accentColor: "var(--primary)" }} />
              Pontual
            </label>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--fg)" }}>
              <input type="radio" name="saleModel" value="RECORRENTE" className="w-4 h-4" style={{ accentColor: "var(--primary)" }} />
              Recorrente / assinatura
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="mt-2 self-start flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
          style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
        >
          Concluir cadastro
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
