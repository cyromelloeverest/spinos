import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { updateOrganizationProfile, updateUserProfile } from "@/lib/actions/settings";
import { FormField } from "@/components/FormField";
import { DbSetupNotice } from "@/components/DbSetupNotice";

export default async function EmpresaSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const [organizationId, userId] = await Promise.all([getCurrentOrganizationId(), getCurrentUserId()]);
  if (!organizationId || !userId) redirect("/onboarding");

  let organization;
  let user;
  try {
    [organization, user] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
  } catch {
    return <DbSetupNotice />;
  }

  if (!organization || !user) redirect("/onboarding");

  return (
    <div className="pt-10 px-10 pb-16 max-w-[560px]">
      <h1 className="text-[25px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Perfil da empresa
      </h1>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Dados da sua empresa e da sua conta dentro do Spinos.
      </p>

      {params.saved && (
        <div
          className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]"
          style={{ borderColor: "var(--good)", color: "var(--good)" }}
        >
          Alterações salvas com sucesso.
        </div>
      )}

      <Section title="Empresa">
        <form action={updateOrganizationProfile} className="flex flex-col gap-4">
          <FormField label="Nome da empresa" name="name" required defaultValue={organization.name} />
          <FormField label="Site" name="site" placeholder="Ex: https://suaempresa.com.br" defaultValue={organization.site ?? ""} />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Cidade" name="city" defaultValue={organization.city ?? ""} />
            <FormField label="Estado" name="state" placeholder="Ex: SP" defaultValue={organization.state ?? ""} />
          </div>
          <FormField label="Segmento" name="segment" placeholder="Ex: Marketing para B2B" defaultValue={organization.segment ?? ""} />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nº de funcionários" name="employeeRange" placeholder="Ex: 11-50" defaultValue={organization.employeeRange ?? ""} />
            <FormField label="Faturamento" name="revenueRange" placeholder="Ex: R$ 1M-5M/ano" defaultValue={organization.revenueRange ?? ""} />
          </div>
          <button
            type="submit"
            className="mt-2 self-start text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
          >
            Salvar empresa
          </button>
        </form>
      </Section>

      <Section title="Sua conta">
        <form action={updateUserProfile} className="flex flex-col gap-4">
          <FormField label="Seu nome" name="name" placeholder="Ex: Cyro Mello" defaultValue={user.name ?? ""} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
              E-mail de login
            </span>
            <div
              className="rounded-[10px] border px-3.5 h-[44px] text-[13.5px]"
              style={{ background: "var(--card-hover)", borderColor: "var(--border)", color: "var(--fg-muted)" }}
            >
              {user.email}
            </div>
            <span className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
              Pra trocar o e-mail de login, fale com o suporte.
            </span>
          </div>
          <button
            type="submit"
            className="mt-2 self-start text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
          >
            Salvar conta
          </button>
        </form>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-9">
      <h2
        className="text-[11.5px] uppercase font-semibold m-0 mb-3.5"
        style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
