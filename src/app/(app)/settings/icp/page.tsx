import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { updateICP } from "@/lib/actions/settings";
import { FormField } from "@/components/FormField";
import { DbSetupNotice } from "@/components/DbSetupNotice";

export default async function IcpSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let icp;
  try {
    icp = await prisma.iCP.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return <DbSetupNotice />;
  }

  if (!icp) redirect("/onboarding/icp");

  const updateWithId = updateICP.bind(null, icp.id);

  return (
    <div className="pt-10 px-10 pb-16 max-w-[560px]">
      <h1 className="text-[25px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Meu ICP
      </h1>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Ajuste o perfil de cliente ideal a qualquer momento — a próxima busca já usa os valores novos.
      </p>

      {params.saved && (
        <div
          className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]"
          style={{ borderColor: "var(--good)", color: "var(--good)" }}
        >
          ICP atualizado com sucesso.
        </div>
      )}

      <form action={updateWithId} className="flex flex-col gap-4">
        <FormField
          label="Segmentos-alvo"
          name="segments"
          placeholder="Ex: Metalúrgica, Fabricante de equipamentos"
          hint="separados por vírgula"
          defaultValue={icp.segments.join(", ")}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Funcionários — mínimo" name="employeeMin" placeholder="Ex: 50" defaultValue={icp.employeeMin?.toString() ?? ""} />
          <FormField label="Funcionários — máximo" name="employeeMax" placeholder="Ex: 500" defaultValue={icp.employeeMax?.toString() ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Estados" name="states" placeholder="Ex: SP, MG" hint="separados por vírgula" defaultValue={icp.states.join(", ")} />
          <FormField label="Cidades prioritárias" name="cities" placeholder="Ex: Campinas, Piracicaba" hint="separadas por vírgula" defaultValue={icp.cities.join(", ")} />
        </div>
        <FormField label="Raio de atuação (km)" name="radiusKm" placeholder="Ex: 70" defaultValue={icp.radiusKm?.toString() ?? ""} />
        <FormField
          label="Cargo do decisor"
          name="decisionMakerTitles"
          placeholder="Ex: Diretor Industrial, Gerente de Compras"
          hint="separados por vírgula"
          defaultValue={icp.decisionMakerTitles.join(", ")}
        />
        <FormField
          label="Tecnologias utilizadas pelo cliente ideal"
          name="technologies"
          placeholder="Ex: SAP, ERP TOTVS"
          hint="separadas por vírgula, opcional"
          defaultValue={icp.technologies.join(", ")}
        />
        <FormField
          label="Palavras-chave"
          name="keywords"
          placeholder="Ex: estruturas metálicas, corte sob medida"
          hint="separadas por vírgula"
          defaultValue={icp.keywords.join(", ")}
        />
        <FormField
          label="Produtos que você vende"
          name="productsSold"
          placeholder="Ex: peças usinadas, chapas cortadas a laser"
          hint="separados por vírgula"
          defaultValue={icp.productsSold.join(", ")}
        />
        <FormField
          label="Serviços que você vende"
          name="servicesSold"
          placeholder="Ex: usinagem, metalização, caldeiraria, corte a laser"
          hint="separados por vírgula"
          defaultValue={icp.servicesSold.join(", ")}
        />

        <button
          type="submit"
          className="mt-2 self-start text-[13px] font-semibold px-5 py-2.5 rounded-lg border cursor-pointer"
          style={{ background: "var(--copper)", borderColor: "var(--copper)", color: "#1a0f06" }}
        >
          Salvar alterações
        </button>
      </form>
    </div>
  );
}
