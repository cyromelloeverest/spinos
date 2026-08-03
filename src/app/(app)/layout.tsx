import { type OrgProfile } from "@/components/Rail";
import { AppShell } from "@/components/AppShell";
import { TrialExpired } from "@/components/TrialExpired";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId, isCurrentUserSuperAdmin } from "@/lib/auth/current-org";
import { signOut } from "@/lib/actions/auth";
import { isTrialExpired, trialDaysLeft } from "@/lib/trial";

async function getCurrentOrganization(): Promise<(OrgProfile & { trialEndsAt: Date | null }) | null> {
  try {
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) return null;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, segment: true, city: true, state: true, trialEndsAt: true },
    });
    return org ?? null;
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [organization, isSuperAdmin] = await Promise.all([getCurrentOrganization(), isCurrentUserSuperAdmin().catch(() => false)]);

  if (!isSuperAdmin && organization && isTrialExpired(organization.trialEndsAt)) {
    return <TrialExpired signOutAction={signOut} />;
  }

  const trialDays = organization ? trialDaysLeft(organization.trialEndsAt) : null;

  return (
    <AppShell organization={organization} signOutAction={signOut} isSuperAdmin={isSuperAdmin} trialDaysLeft={trialDays}>
      {children}
    </AppShell>
  );
}
