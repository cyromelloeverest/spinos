import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId, getCurrentUserId, getCurrentMembership } from "@/lib/auth/current-org";
import { updateOrganizationProfile, updateUserProfile } from "@/lib/actions/settings";
import { requestEmailChange } from "@/lib/actions/auth";
import { createCheckoutSession, createPortalSession } from "@/lib/actions/billing";
import { requestAccountDeletion } from "@/lib/actions/privacy";
import { PLANS } from "@/lib/plans";
import { FormField } from "@/components/FormField";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { Check, Download, ShieldAlert } from "lucide-react";

function subscriptionStatusLabel(org: { subscriptionStatus: string | null; trialEndsAt: Date | null }): string {
  if (org.subscriptionStatus === "active") return "Assinatura ativa";
  if (org.subscriptionStatus === "trialing") return "Assinatura em período de teste";
  if (org.subscriptionStatus === "past_due") return "Pagamento pendente — atualize seu cartão";
  if (org.subscriptionStatus === "canceled") return "Assinatura cancelada";
  if (org.trialEndsAt) return "Período de teste gratuito (sem assinatura)";
  return "Sem assinatura ativa";
}

export default async function EmpresaSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    emailPendente?: string;
    emailAtualizado?: string;
    emailError?: string;
    assinatura?: string;
    error?: string;
    privacidadeError?: string;
    exclusaoSolicitada?: string;
  }>;
}) {
  const params = await searchParams;
  const [organizationId, userId, membership] = await Promise.all([
    getCurrentOrganizationId(),
    getCurrentUserId(),
    getCurrentMembership(),
  ]);
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
    <div className="pt-10 px-4 md:px-10 pb-16 max-w-[560px]">
      <h1 className="text-[25px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Perfil da empresa
      </h1>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Dados da sua empresa e da sua conta dentro do Spinos.
      </p>

      {params.saved && (
        <div
          className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]"
          style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
        >
          Alterações salvas com sucesso.
        </div>
      )}

      <Section title="Assinatura">
        {params.assinatura === "sucesso" && (
          <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
            Assinatura confirmada! Seu plano foi atualizado.
          </div>
        )}
        {params.assinatura === "cancelado" && (
          <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
            Checkout cancelado — nenhuma cobrança foi feita.
          </div>
        )}
        {params.error && (
          <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
            {params.error}
          </div>
        )}

        <div
          className="rounded-[16px] border p-4 mb-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div>
            <div className="text-[15px] font-semibold">{PLANS[organization.plan].name}</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
              {subscriptionStatusLabel(organization)}
            </div>
          </div>
          {organization.stripeCustomerId && (
            <form action={createPortalSession}>
              <button
                type="submit"
                className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer"
                style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
              >
                Gerenciar assinatura
              </button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.values(PLANS).map((plan) => {
            const isCurrent = plan.id === organization.plan;
            return (
              <div
                key={plan.id}
                className="rounded-[16px] border p-4 flex flex-col gap-3"
                style={{
                  borderColor: isCurrent ? "var(--primary-line)" : "var(--border)",
                  background: "var(--card)",
                }}
              >
                <div>
                  <div className="text-[13.5px] font-semibold">{plan.name}</div>
                  <div className="mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                    <span className="text-[20px] font-bold" style={{ letterSpacing: "-0.02em" }}>
                      R${plan.priceMonthlyBRL}
                    </span>
                    <span className="text-[12px]" style={{ color: "var(--fg-faint)" }}>
                      /mês
                    </span>
                  </div>
                </div>
                {isCurrent ? (
                  <div className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: "var(--primary)" }}>
                    <Check size={14} strokeWidth={2} />
                    Plano atual
                  </div>
                ) : (
                  <form action={createCheckoutSession.bind(null, plan.id)}>
                    <button
                      type="submit"
                      className="w-full text-[12.5px] font-semibold px-3 py-2 rounded-[10px] border-0 cursor-pointer"
                      style={{ background: "var(--primary)", color: "#ffffff" }}
                    >
                      Assinar
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Empresa">
        <form action={updateOrganizationProfile} className="flex flex-col gap-4">
          <FormField label="Nome da empresa" name="name" required defaultValue={organization.name} />
          <FormField label="Site" name="site" placeholder="Ex: https://suaempresa.com.br" defaultValue={organization.site ?? ""} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Cidade" name="city" defaultValue={organization.city ?? ""} />
            <FormField label="Estado" name="state" placeholder="Ex: SP" defaultValue={organization.state ?? ""} />
          </div>
          <FormField label="Segmento" name="segment" placeholder="Ex: Marketing para B2B" defaultValue={organization.segment ?? ""} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Nº de funcionários" name="employeeRange" placeholder="Ex: 11-50" defaultValue={organization.employeeRange ?? ""} />
            <FormField label="Faturamento" name="revenueRange" placeholder="Ex: R$ 1M-5M/ano" defaultValue={organization.revenueRange ?? ""} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="CNPJ" name="cnpj" placeholder="Ex: 12.345.678/0001-90" defaultValue={organization.cnpj ?? ""} />
            <FormField label="Telefone comercial" name="phone" placeholder="Ex: (11) 4000-0000" defaultValue={organization.phone ?? ""} />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Cargo" name="role" placeholder="Ex: Diretor Comercial" defaultValue={user.role ?? ""} />
            <FormField label="Telefone" name="phone" placeholder="Ex: (11) 99999-0000" defaultValue={user.phone ?? ""} />
          </div>
          <button
            type="submit"
            className="self-start text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
          >
            Salvar conta
          </button>
        </form>
      </Section>

      <Section title="E-mail de login">
        {params.emailPendente && (
          <div
            className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px] leading-[1.6]"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            Enviamos um link de confirmação. O e-mail só muda depois que você clicar nele — confira sua caixa de entrada (e o spam).
          </div>
        )}
        {params.emailAtualizado && (
          <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
            E-mail atualizado com sucesso.
          </div>
        )}
        {params.emailError && (
          <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
            {params.emailError}
          </div>
        )}
        <div className="flex flex-col gap-1.5 mb-1">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
            E-mail atual
          </span>
          <div
            className="rounded-[10px] border px-3.5 h-[44px] flex items-center text-[13.5px]"
            style={{ background: "var(--card-hover)", borderColor: "var(--border)", color: "var(--fg-muted)" }}
          >
            {user.email}
          </div>
        </div>
        <form action={requestEmailChange} className="flex flex-col gap-3">
          <FormField label="Novo e-mail" name="email" placeholder="voce@empresa.com.br" required />
          <button
            type="submit"
            className="self-start text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
          >
            Trocar e-mail
          </button>
        </form>
      </Section>

      <Section title="Privacidade e Dados">
        <div className="flex items-center gap-4 text-[12.5px] mb-5" style={{ color: "var(--fg-muted)" }}>
          <Link href="/privacidade" target="_blank" style={{ color: "var(--primary)" }}>
            Política de Privacidade
          </Link>
          <Link href="/termos" target="_blank" style={{ color: "var(--primary)" }}>
            Termos de Uso
          </Link>
        </div>

        <div
          className="rounded-[16px] border p-4 mb-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div>
            <div className="text-[13.5px] font-semibold">Baixar meus dados</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
              Exporta um arquivo com os dados da sua empresa, equipe e oportunidades.
            </div>
          </div>
          <a
            href="/api/account/export"
            className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
          >
            <Download size={14} strokeWidth={1.75} />
            Baixar dados
          </a>
        </div>

        {membership?.role === "OWNER" && (
          <div className="rounded-[16px] border p-4" style={{ background: "var(--critical-soft)", borderColor: "var(--critical)" }}>
            <div className="flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: "var(--critical)" }}>
              <ShieldAlert size={15} strokeWidth={1.75} />
              Excluir conta e organização
            </div>
            <p className="text-[12.5px] mt-1.5 mb-3" style={{ color: "var(--fg-muted)" }}>
              Envia um pedido de exclusão para nossa equipe, que confirma e apaga permanentemente os dados da{" "}
              {organization.name} (LGPD, art. 18). Um dono confirma a exclusão manualmente — não é instantâneo.
            </p>

            {params.privacidadeError && (
              <div className="mb-3 rounded-[8px] border px-3.5 py-2.5 text-[12px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
                {params.privacidadeError}
              </div>
            )}
            {params.exclusaoSolicitada && (
              <div className="mb-3 rounded-[8px] border px-3.5 py-2.5 text-[12px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
                Pedido enviado. Nossa equipe vai confirmar por e-mail antes de excluir qualquer dado.
              </div>
            )}

            <form action={requestAccountDeletion} className="flex flex-col gap-2.5 items-start">
              <label className="flex items-start gap-2 text-[12px]" style={{ color: "var(--fg-muted)" }}>
                <input type="checkbox" required className="mt-0.5" />
                Entendo que essa ação é irreversível e apaga todos os dados da organização.
              </label>
              <button
                type="submit"
                className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border-0 cursor-pointer"
                style={{ background: "var(--critical)", color: "#ffffff" }}
              >
                Solicitar exclusão da conta
              </button>
            </form>
          </div>
        )}
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
