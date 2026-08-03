import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isCurrentUserSuperAdmin } from "@/lib/auth/current-org";
import { PLANS, type PlanId } from "@/lib/plans";
import { isTrialExpired, trialDaysLeft } from "@/lib/trial";
import { extendTrial, removeTrialLimit } from "@/lib/actions/admin";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { PlanSelect } from "@/components/PlanSelect";
import { ShieldCheck } from "lucide-react";

async function fetchOrganizations() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { orderBy: { createdAt: "asc" }, take: 1, include: { user: { select: { email: true } } } },
      _count: { select: { users: true } },
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

export default async function AdminPage() {
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) redirect("/");

  let organizations: Awaited<ReturnType<typeof fetchOrganizations>>;
  try {
    organizations = await fetchOrganizations();
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

      <div className="px-4 md:px-10 pt-6 pb-16">
        <div className="rounded-[16px] border overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card-hover)" }}>
                  <Th>Empresa</Th>
                  <Th>Contato</Th>
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
                  return (
                    <tr key={org.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <Td>
                        <div className="font-semibold">{org.name}</div>
                        <div className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
                          {org.city ? `${org.city}, ${org.state}` : "—"}
                        </div>
                      </Td>
                      <Td>{org.users[0]?.user.email ?? "—"}</Td>
                      <Td>{org._count.users}</Td>
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
                                className="text-[11px] font-medium px-2 py-1 rounded-[6px] border cursor-pointer"
                                style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
                              >
                                +30 dias
                              </button>
                            </form>
                            {org.trialEndsAt !== null && (
                              <form action={removeTrialLimit.bind(null, org.id)}>
                                <button
                                  type="submit"
                                  className="text-[11px] font-medium px-2 py-1 rounded-[6px] border cursor-pointer"
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
