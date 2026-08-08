import { createICP } from "@/lib/actions/onboarding";
import { FormField } from "@/components/FormField";
import { TextAreaField } from "@/components/TextAreaField";
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
        Você pode refinar mais detalhes (funcionários, ticket médio, tecnologias etc.) depois em Configurações.
      </p>

      <form action={createICP} className="flex flex-col gap-4">
        <TextAreaField
          label="Descreva seu cliente ideal com suas palavras"
          name="idealCustomerDescription"
          placeholder="Ex: Empresas industriais em expansão física, que provavelmente vão precisar de estruturas metálicas customizadas nos próximos meses — não olhamos bem pra quem já tem fornecedor fixo há mais de 5 anos."
          hint="O campo que mais ajuda a IA — texto livre capta nuances que os campos abaixo não pegam."
          rows={4}
        />
        <FormField
          label="Segmentos-alvo"
          name="segments"
          placeholder="Ex: Indústria, Varejo, Tecnologia"
          hint="separados por vírgula"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Estados" name="states" placeholder="Ex: SP, MG" hint="separados por vírgula" />
          <FormField label="Raio de atuação (km)" name="radiusKm" placeholder="Ex: 70" hint="opcional" />
        </div>
        <FormField
          label="Produtos que você vende"
          name="productsSold"
          placeholder="Ex: software de gestão, equipamentos industriais"
          hint="separados por vírgula"
        />
        <FormField
          label="Serviços que você vende"
          name="servicesSold"
          placeholder="Ex: consultoria, instalação, manutenção"
          hint="separados por vírgula"
        />
        <FormField
          label="Palavras-chave"
          name="keywords"
          placeholder="Ex: expansão, nova unidade, contratação"
          hint="separadas por vírgula, opcional"
        />

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
