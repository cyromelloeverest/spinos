"use client";

import { useState } from "react";
import { Rail, type OrgProfile } from "./Rail";
import { TopBar } from "./TopBar";

export function AppShell({
  organization,
  signOutAction,
  children,
}: {
  organization: OrgProfile;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid" style={{ gridTemplateColumns: "240px 1fr" }}>
      <Rail organization={organization} signOutAction={signOutAction} open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(15,23,42,0.5)" }}
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="min-w-0 flex flex-col">
        <TopBar organizationName={organization?.name ?? "Configurar empresa"} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
