import Link from "next/link";
import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { EmptyState } from "@/components/EmptyState";
import { ACTIVITY_TYPE_LABEL } from "@/lib/crm/activities";
import { startOfDayBRT, endOfDayBRT, formatBrasilia } from "@/lib/crm/dates";
import { logError } from "@/lib/log-error";
import type { Prisma } from "@/generated/prisma/client";

const TABS = [
  { key: "atrasadas", label: "Atrasadas" },
  { key: "hoje", label: "Hoje" },
  { key: "proximas", label: "Próximas" },
  { key: "concluidas", label: "Concluídas" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function whereFor(tab: Tab, organizationId: string, mineUserId: string | null, now: Date): Prisma.ActivityWhereInput {
  const mine: Prisma.ActivityWhereInput = mineUserId ? { OR: [{ ownerUserId: mineUserId }, { ownerUserId: null }] } : {};
  const start = startOfDayBRT(now);
  const end = endOfDayBRT(now);
  if (tab === "atrasadas") return { organizationId, status: "OPEN", dueAt: { lt: start }, ...mine };
  if (tab === "hoje") return { organizationId, status: "OPEN", dueAt: { gte: start, lt: end }, ...mine };
  if (tab === "proximas") return { organizationId, status: "OPEN", dueAt: { gte: end }, ...mine };
  return { organizationId, status: "DONE", ...mine };
}

export default async function AtividadesPage({ searchParams }: { searchParams: Promise<{ aba?: string; owner?: string }> }) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");
  const userId = await getCurrentUserId();
  const tab: Tab = TABS.some((t) => t.key === params.aba) ? (params.aba as Tab) : "hoje";
  const owner: "me" | "all" = params.owner === "all" ? "all" : "me";
  const now = new Date();

  let rows;
  try {
    rows = await withOrgContext(organizationId, (tx) =>
      tx.activity.findMany({
        where: whereFor(tab, organizationId, owner === "me" ? userId : null, now),
        orderBy: tab === "concluidas" ? { doneAt: "desc" } : { dueAt: "asc" },
        take: 100,
        include: { account: { select: { name: true, scores: { select: { id: true }, take: 1 } } } },
      }),
    );
  } catch (err) {
    logError("atividades: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }

  const href = (aba: string, o = owner) => `/atividades?aba=${aba}&owner=${o}`;

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[880px]">
      <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>Atividades</h1>
      <p className="m-0 mb-5 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        O que precisa ser feito nas suas negociações. Abra uma atividade para concluir e definir o próximo passo.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key)} className="no-underline text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[10px] border" style={{ background: tab === t.key ? "var(--primary)" : "var(--card)", color: tab === t.key ? "#ffffff" : "var(--fg-muted)", borderColor: tab === t.key ? "var(--primary)" : "var(--border)" }}>
            {t.label}
          </Link>
        ))}
        <span className="flex-1" />
        {(["me", "all"] as const).map((o) => (
          <Link key={o} href={href(tab, o)} className="no-underline text-[12.5px] font-semibold px-3 py-1.5 rounded-[10px]" style={{ background: owner === o ? "var(--card-hover)" : "transparent", color: owner === o ? "var(--fg)" : "var(--fg-muted)" }}>
            {o === "me" ? "Minhas" : "Toda a equipe"}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message={tab === "concluidas" ? "Nenhuma atividade concluída ainda." : "Nada por aqui. Agende o próximo passo de uma negociação no pipeline."} />
      ) : (
        <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {rows.map((a, i) => {
            const scoreId = a.account?.scores[0]?.id;
            const late = a.status === "OPEN" && a.dueAt !== null && a.dueAt < now;
            const inner = (
              <div className="flex items-center justify-between gap-4 px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--fg)" }}>{a.title ?? ACTIVITY_TYPE_LABEL[a.type]}</div>
                  <div className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
                    {a.account?.name ?? "Sem conta"} · {ACTIVITY_TYPE_LABEL[a.type]}
                    {a.automation ? " · automática" : ""}
                  </div>
                </div>
                <div className="text-[12px] flex-shrink-0" style={{ color: late ? "var(--critical)" : "var(--fg-muted)", fontWeight: late ? 600 : 400 }}>
                  {formatBrasilia(a.status === "DONE" ? a.doneAt : a.dueAt)}
                </div>
              </div>
            );
            return scoreId ? (
              <Link key={a.id} href={`/pipeline?abrir=${scoreId}&owner=${owner}`} className="block no-underline" style={{ color: "var(--fg)" }}>{inner}</Link>
            ) : (
              <div key={a.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
