import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/auth/current-org";
import { getPlan } from "@/lib/plans";
import { inviteMember, cancelInvite, removeMember } from "@/lib/actions/team";
import { FormField } from "@/components/FormField";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { X } from "lucide-react";

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ROLE_LABEL: Record<string, string> = { OWNER: "Dono", ADMIN: "Administrador", MEMBER: "Membro" };

export default async function EquipeSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string; error?: string }>;
}) {
  const params = await searchParams;
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");

  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";

  let organization;
  let members;
  let invites;
  try {
    [organization, members, invites] = await Promise.all([
      prisma.organization.findUnique({ where: { id: membership.organizationId } }),
      prisma.membership.findMany({
        where: { organizationId: membership.organizationId },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.invite.findMany({
        where: { organizationId: membership.organizationId, acceptedAt: null },
        orderBy: { createdAt: "desc" },
      }),
    ]);
  } catch {
    return <DbSetupNotice />;
  }

  if (!organization) redirect("/onboarding");

  const plan = getPlan(organization.plan);
  const pendingInvites = invites.filter((i) => i.expiresAt > new Date());
  const seatsUsed = members.length + pendingInvites.length;

  return (
    <div className="pt-10 px-4 md:px-10 pb-16 max-w-[640px]">
      <h1 className="text-[25px] font-medium m-0 mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Equipe
      </h1>
      <p className="m-0 mb-8 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Quem tem acesso à {organization.name} no Spinos.
        {plan.maxUsers !== null && (
          <span> {seatsUsed}/{plan.maxUsers} usuários do plano {plan.name}.</span>
        )}
      </p>

      {params.invited && (
        <div className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--good)", color: "var(--good)" }}>
          Convite enviado.
        </div>
      )}
      {params.error && (
        <div className="mb-6 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
          {params.error}
        </div>
      )}

      <div className="flex flex-col gap-2.5 mb-8">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-4 rounded-[12px] border px-4 py-3"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--fg)" }}>
                {m.user.name || m.user.email}
              </div>
              <div className="text-[12px]" style={{ color: "var(--fg-faint)" }}>
                {m.user.email} · {ROLE_LABEL[m.role]}
              </div>
            </div>
            {canManage && m.role !== "OWNER" && (
              <form action={removeMember.bind(null, m.id)}>
                <button
                  type="submit"
                  className="flex items-center justify-center w-8 h-8 rounded-[8px] border cursor-pointer flex-shrink-0"
                  style={{ background: "transparent", borderColor: "var(--border)", color: "var(--fg-faint)" }}
                  title="Remover da equipe"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </form>
            )}
          </div>
        ))}

        {pendingInvites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between gap-4 rounded-[12px] border px-4 py-3"
            style={{ borderColor: "var(--border)", background: "var(--card-hover)" }}
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--fg-muted)" }}>
                {inv.email}
              </div>
              <div className="text-[12px]" style={{ color: "var(--fg-faint)" }}>
                Convite pendente · expira em {formatDate(inv.expiresAt)}
              </div>
            </div>
            {canManage && (
              <form action={cancelInvite.bind(null, inv.id)}>
                <button
                  type="submit"
                  className="flex items-center justify-center w-8 h-8 rounded-[8px] border cursor-pointer flex-shrink-0"
                  style={{ background: "transparent", borderColor: "var(--border)", color: "var(--fg-faint)" }}
                  title="Cancelar convite"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <>
          <h2
            className="text-[11.5px] uppercase font-semibold m-0 mb-3.5"
            style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}
          >
            Convidar
          </h2>
          <form action={inviteMember} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="w-full sm:flex-1">
              <FormField label="E-mail" name="email" placeholder="colega@empresa.com.br" required />
            </div>
            <button
              type="submit"
              className="text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer w-full sm:w-auto"
              style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff", height: "44px" }}
            >
              Enviar convite
            </button>
          </form>
        </>
      )}
    </div>
  );
}
