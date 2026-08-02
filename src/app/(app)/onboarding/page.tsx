import { createOrganization } from "@/lib/actions/onboarding";
import { FormField } from "@/components/FormField";
import { DbSetupNotice } from "@/components/DbSetupNotice";

export default async function OnboardingCompanyPage({
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
        Passo 1 de 2
      </div>
      <h1
        className="text-[25px] font-medium m-0 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Conte sobre a sua empresa
      </h1>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Usamos isso para calibrar como a IA interpreta sinais de mercado a favor do seu negócio.
      </p>

      <form action={createOrganization} className="flex flex-col gap-4">
        <FormField label="Nome da empresa" name="name" placeholder="Ex: Sakatec" required />
        <FormField label="Site" name="site" placeholder="https://" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Cidade" name="city" placeholder="Ex: Sumaré" />
          <FormField label="Estado" name="state" placeholder="Ex: SP" />
        </div>
        <FormField
          label="Segmento"
          name="segment"
          placeholder="Ex: Usinagem, metalização e caldeiraria"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Número de funcionários" name="employeeRange" placeholder="Ex: 11-50" />
          <FormField label="Faturamento aproximado" name="revenueRange" placeholder="Ex: R$1M-5M" />
        </div>

        <button
          type="submit"
          className="mt-2 self-start text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
          style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
        >
          Continuar para o ICP →
        </button>
      </form>
    </div>
  );
}
