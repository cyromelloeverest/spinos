import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isCurrentUserSuperAdmin } from "@/lib/auth/current-org";
import { PLANS, type PlanId } from "@/lib/plans";
import { isTrialExpired, trialDaysLeft } from "@/lib/trial";
import { extendTrial, removeTrialLimit, adminInviteUser, adminRemoveUser, adminCancelInvite, adminToggleSearchBlock } from "@/lib/actions/admin";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { PlanSelect } from "@/components/PlanSelect";
import { ShieldCheck, X, Ban, Play, UserX } from "lucide-react";

const ROLE_LABEL: Record<string, string> = { OWNER: "Dono", ADMIN: "Admin", MEMBER: "Membro" };

async function fetchOrganizations() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { orderBy: { createdAt: "asc" }, include: { user: { select: { email: true, name: true } } } },
      invites: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  const withCounts = await Promise.all(
    organizations.map(async (org) => {
      const activeOpportunities = await prisma.opportunityScore.count({
        where: { organizationId: org.id, stage: null, status: { not: "DISMISSED" } },
      });
      return { ...org, activeOpportunities };
    }),
  );

  return withCounts;
}

function fetchOrphanUsers() {
  return prisma.user.findMany({
    where: { memberships: { none: {} } },
    orderBy: { createdAt: "desc" },
  });
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) redirect("/");

  const params = await searchParams;

  let organizations: Awaited<ReturnType<typeof fetchOrganizations>>;
  let orphanUsers: Awaited<ReturnType<typeof fetchOrphanUsers>> = [];
  try {
    [organizations, orphanUsers] = await Promise.all([fetchOrganizations(), fetchOrphanUsers()]);
  } catch {
    return <DbSetupNotice />;
  }

  return (
    <div>
      <div className="pt-6 px-4 md:px-10">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={20} strokeWidth={1.75} style={{ color: "var(--primary)" }} />
          <h1 className="text-[25px] font-medium m-0" style={{ fontFamily: "var(--font-display)" }}>
            Painel administrador
          </h1>
        </div>
        <p className="m-0 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          {organizations.length} empresa(s) cliente(s) no Spinos.
        </p>
      </div>

      {params.error && (
        <div
          className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]"
          style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
        >
          {params.error}
        </div>
      )}

      <div className="px-4 md:px-10 pt-6 pb-16">
        <div className="rounded-[16px] border overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card-hover)" }}>
                  <Th>Empresa</Th>
                  <Th>Usuários</Th>
                  <Th>Oportunidades ativas</Th>
                  <Th>Plano</Th>
                  <Th>Teste grátis</Th>
                  <Th>Criada em</Th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => {
                  const limit = PLANS[org.plan as PlanId].maxActiveOpportunities;
                  const overLimit = limit !== null && org.activeOpportunities > limit;
                  const expired = isTrialExpired(org.trialEndsAt);
                  const daysLeft = trialDaysLeft(org.trialEndsAt);
                  const pendingInvites = org.invites.filter((i) => i.expiresAt > new Date());
                  return (
                    <tr key={org.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <Td>
                        <div className="font-semibold">{org.name}</div>
                        <div className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
                          {org.city ? `${org.city}, ${org.state}` : "—"}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1.5 min-w-[220px]">
                          {org.users.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate flex items-center gap-1.5">
                                  {m.user.name || m.user.email}
                                  {m.searchBlocked && (
                                    <span
                                      className="text-[9.5px] font-semibold uppercase rounded-full px-1.5 py-[1px] flex-shrink-0"
                                      style={{ background: "var(--critical-soft, #FEE2E2)", color: "var(--critical)" }}
                                    >
                                      Busca bloqueada
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px]" style={{ color: "var(--fg-faint)" }}>
                                  {m.user.email} · {ROLE_LABEL[m.role]}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <form action={adminToggleSearchBlock.bind(null, org.id, m.id)}>
                                  <button
                                    type="submit"
                                    className="flex items-center justify-center w-6 h-6 rounded-[8px] border cursor-pointer"
                                    style={{
                                      background: "transparent",
                                      borderColor: "var(--border)",
                                      color: m.searchBlocked ? "var(--primary)" : "var(--fg-faint)",
                                    }}
                                    title={m.searchBlocked ? "Liberar busca" : "Bloquear busca temporariamente"}
                                    aria-label={m.searchBlocked ? "Liberar busca" : "Bloquear busca temporariamente"}
                                  >
                                    {m.searchBlocked ? <Play size={12} strokeWidth={1.75} /> : <Ban size={12} strokeWidth={1.75} />}
                                  </button>
                                </form>
                                <form action={adminRemoveUser.bind(null, org.id, m.id)}>
                                  <button
                                    type="submit"
                                    className="flex items-center justify-center w-6 h-6 rounded-[8px] border cursor-pointer"
                                    style={{ background: "transparent", borderColor: "var(--border)", color: "var(--fg-faint)" }}
                                    title="Remover"
                                    aria-label="Remover"
                                  >
                                    <X size={12} strokeWidth={1.75} />
                                  </button>
                                </form>
                              </div>
                            </div>
                          ))}

                          {pendingInvites.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate" style={{ color: "var(--fg-muted)" }}>
                                  {inv.email}
                                </div>
                                <div className="text-[11px]" style={{ color: "var(--fg-faint)" }}>
                                  Convite pendente
                                </div>
                              </div>
                              <form action={adminCancelInvite.bind(null, org.id, inv.id)}>
                                <button
                                  type="submit"
                                  className="flex items-center justify-center w-6 h-6 rounded-[8px] border cursor-pointer flex-shrink-0"
                                  style={{ background: "transparent", borderColor: "var(--border)", color: "var(--fg-faint)" }}
                                  title="Cancelar convite"
                                  aria-label="Cancelar convite"
                                >
                                  <X size={12} strokeWidth={1.75} />
                                </button>
                              </form>
                            </div>
                          ))}

                          <form action={adminInviteUser.bind(null, org.id)} className="flex gap-1.5 mt-1">
                            <input
                              name="email"
                              type="email"
                              placeholder="e-mail@empresa.com"
                              className="min-w-0 flex-1 rounded-[8px] border px-2 py-1 text-[11.5px] outline-none"
                              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
                            />
                            <button
                              type="submit"
                              className="text-[11px] font-medium px-2.5 py-1 rounded-[8px] border cursor-pointer flex-shrink-0"
                              style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
                            >
                              + adicionar
                            </button>
                          </form>
                        </div>
                      </Td>
                      <Td>
                        <span style={{ color: overLimit ? "var(--critical)" : "var(--fg)" }}>
                          {org.activeOpportunities}
                          {limit !== null ? ` / ${limit}` : ""}
                        </span>
                      </Td>
                      <Td>
                        <PlanSelect organizationId={org.id} currentPlan={org.plan} />
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1.5 min-w-[160px]">
                          <span style={{ color: org.trialEndsAt === null ? "var(--fg-faint)" : expired ? "var(--critical)" : "var(--fg)" }}>
                            {org.trialEndsAt === null
                              ? "Sem limite"
                              : expired
                                ? `Expirado há ${Math.abs(daysLeft ?? 0)} dia(s)`
                                : `${daysLeft} dia(s) restante(s)`}
                          </span>
                          <div className="flex gap-1.5">
                            <form action={extendTrial.bind(null, org.id, 30)}>
                              <button
                                type="submit"
                                className="text-[11px] font-medium px-2 py-1 rounded-[8px] border cursor-pointer"
                                style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
                              >
                                +30 dias
                              </button>
                            </form>
                            {org.trialEndsAt !== null && (
                              <form action={removeTrialLimit.bind(null, org.id)}>
                                <button
                                  type="submit"
                                  className="text-[11px] font-medium px-2 py-1 rounded-[8px] border cursor-pointer"
                                  style={{ background: "transparent", borderColor: "var(--border)", color: "var(--fg-faint)" }}
                                >
                                  Sem limite
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td>{org.createdAt.toLocaleDateString("pt-BR")}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {orphanUsers.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-2.5">
              <UserX size={16} strokeWidth={1.75} style={{ color: "var(--warn)" }} />
              <h2 className="text-[13px] font-semibold m-0">Cadastros incompletos</h2>
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: "var(--fg-muted)" }}>
              Confirmaram o e-mail mas ainda não criaram uma empresa — não aparecem na lista acima porque ainda não pertencem a nenhuma organização.
            </p>
            <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {orphanUsers.map((u, i) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-4 py-2.5 text-[13px]"
                  style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
                >
                  <span>{u.name || u.email}</span>
                  <span style={{ color: "var(--fg-faint)" }}>
                    {u.email} · desde {u.createdAt.toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left text-[10.5px] uppercase font-semibold px-4 py-3 whitespace-nowrap"
      style={{ color: "var(--fg-faint)", letterSpacing: "0.05em" }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}
