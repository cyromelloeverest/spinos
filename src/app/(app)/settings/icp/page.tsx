import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { updateICP } from "@/lib/actions/settings";
import { FormField } from "@/components/FormField";
import { TextAreaField } from "@/components/TextAreaField";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { logError } from "@/lib/log-error";
import { SIGNAL_CATEGORY_LABEL, SIGNAL_CATEGORIES } from "@/lib/signal-categories";
import type { SignalCategory } from "@/generated/prisma/enums";

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
    icp = await withOrgContext(organizationId, (tx) =>
      tx.iCP.findFirst({
        where: { organizationId, isActive: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch (err) {
    logError("settings/icp: falha ao carregar ICP", err, { organizationId });
    return <DbSetupNotice />;
  }

  if (!icp) redirect("/onboarding/icp");

  const updateWithId = updateICP.bind(null, icp.id);

  return (
    <div className="pt-10 px-4 md:px-10 pb-16 max-w-[560px]">
      <h1 className="text-[25px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Meu ICP
      </h1>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Ajuste o perfil de cliente ideal a qualquer momento — a próxima busca já usa os valores novos.
      </p>

      {params.saved && (
        <div
          className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]"
          style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Funcionários — mínimo" name="employeeMin" placeholder="Ex: 50" defaultValue={icp.employeeMin?.toString() ?? ""} />
          <FormField label="Funcionários — máximo" name="employeeMax" placeholder="Ex: 500" defaultValue={icp.employeeMax?.toString() ?? ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Ticket médio (R$)"
            name="averageTicketBRL"
            placeholder="Ex: 5000"
            hint="opcional — ajuda a IA a calibrar porte"
            defaultValue={icp.averageTicketBRL?.toString() ?? ""}
          />
          <FormField
            label="Ciclo de vendas típico"
            name="salesCycleLength"
            placeholder="Ex: 2 a 4 semanas"
            hint="opcional"
            defaultValue={icp.salesCycleLength ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
            Modelo de venda
          </span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--fg)" }}>
              <input
                type="radio"
                name="saleModel"
                value="PONTUAL"
                defaultChecked={icp.saleModel === "PONTUAL"}
                className="w-4 h-4"
                style={{ accentColor: "var(--primary)" }}
              />
              Pontual
            </label>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--fg)" }}>
              <input
                type="radio"
                name="saleModel"
                value="RECORRENTE"
                defaultChecked={icp.saleModel === "RECORRENTE"}
                className="w-4 h-4"
                style={{ accentColor: "var(--primary)" }}
              />
              Recorrente / assinatura
            </label>
          </div>
        </div>

        <TextAreaField
          label="Descreva seu cliente ideal com suas palavras"
          name="idealCustomerDescription"
          placeholder="Ex: Empresas industriais em expansão física, que provavelmente vão precisar de estruturas metálicas customizadas nos próximos meses — não olhamos bem pra quem já tem fornecedor fixo há mais de 5 anos."
          hint="Opcional, mas ajuda bastante — texto livre capta nuance que os campos acima não pegam."
          defaultValue={icp.idealCustomerDescription ?? ""}
          rows={4}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
            Quais tipos de sinal importam mais pra você?
          </span>
          <span className="text-[11.5px] mb-1" style={{ color: "var(--fg-faint)" }}>
            A busca vai priorizar esses tipos de sinal. Nenhum marcado = considera todos igualmente.
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SIGNAL_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--fg)" }}>
                <input
                  type="checkbox"
                  name="preferredSignalCategories"
                  value={cat}
                  defaultChecked={icp.preferredSignalCategories.includes(cat as SignalCategory)}
                  className="w-4 h-4"
                  style={{ accentColor: "var(--primary)" }}
                />
                {SIGNAL_CATEGORY_LABEL[cat]}
              </label>
            ))}
          </div>
        </div>

        <FormField
          label="Empresas a evitar"
          name="companiesToAvoid"
          placeholder="Ex: Empresa X (já é cliente), Empresa Y (concorrente)"
          hint="separadas por vírgula — não serão sugeridas em novas buscas"
          defaultValue={icp.companiesToAvoid.join(", ")}
        />

        <button
          type="submit"
          className="mt-2 self-start text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
          style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
        >
          Salvar alterações
        </button>
      </form>
    </div>
  );
}
