"use client";

import { useState } from "react";
import { Rail, type OrgProfile } from "./Rail";
import { TopBar } from "./TopBar";

export function AppShell({
  organization,
  signOutAction,
  isSuperAdmin = false,
  trialDaysLeft = null,
  children,
}: {
  organization: OrgProfile;
  signOutAction: () => Promise<void>;
  isSuperAdmin?: boolean;
  trialDaysLeft?: number | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid" style={{ gridTemplateColumns: "240px 1fr" }}>
      <Rail
        organization={organization}
        signOutAction={signOutAction}
        isSuperAdmin={isSuperAdmin}
        open={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(15,23,42,0.5)" }}
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="min-w-0 flex flex-col">
        <TopBar organizationName={organization?.name ?? "Configurar empresa"} onMenuClick={() => setMobileNavOpen(true)} />
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
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
