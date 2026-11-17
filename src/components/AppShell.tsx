"use client";

import { useState } from "react";
import { Rail, type OrgProfile, type OrgMembership } from "./Rail";
import { TopBar } from "./TopBar";

// Layout padrão dos apps da Everest: fundo escuro com menu lateral e barra superior, e o conteúdo
// num painel branco de canto arredondado. Menu e barra ficam fixos; só o painel rola.
export function AppShell({
  organization,
  signOutAction,
  isSuperAdmin = false,
  trialDaysLeft = null,
  memberships = [],
  currentOrganizationId = null,
  children,
}: {
  organization: OrgProfile;
  signOutAction: () => Promise<void>;
  isSuperAdmin?: boolean;
  trialDaysLeft?: number | null;
  memberships?: OrgMembership[];
  currentOrganizationId?: string | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div
      className="h-dvh overflow-hidden md:grid"
      style={{ gridTemplateColumns: "248px 1fr", background: "linear-gradient(165deg, #0f172a 0%, #13244d 100%)" }}
    >
      <Rail isSuperAdmin={isSuperAdmin} open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(15,23,42,0.5)" }}
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="min-w-0 h-dvh flex flex-col">
        <TopBar
          organizationName={organization?.name ?? "Configurar empresa"}
          memberships={memberships}
          currentOrganizationId={currentOrganizationId}
          signOutAction={signOutAction}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <div className="flex-1 min-h-0 overflow-y-auto rounded-t-[20px] md:rounded-tl-[28px] md:rounded-tr-none" style={{ background: "var(--surface)" }}>
          {trialDaysLeft !== null && (
            <div
              className="px-4 md:px-10 py-2 text-[12px] text-center"
              style={{
                background: trialDaysLeft <= 2 ? "var(--warn-soft, #FEF3C7)" : "var(--card-hover)",
                color: trialDaysLeft <= 2 ? "var(--warn)" : "var(--fg-muted)",
              }}
            >
              {trialDaysLeft <= 0
                ? "Seu teste grátis termina hoje."
                : `Seu teste grátis termina em ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"}.`}
            </div>
          )}
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
