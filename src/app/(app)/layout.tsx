import { type OrgProfile, type OrgMembership } from "@/components/Rail";
import { AppShell } from "@/components/AppShell";
import { TrialExpired } from "@/components/TrialExpired";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentMembership, getUserMemberships, isCurrentUserSuperAdmin } from "@/lib/auth/current-org";
import { signOut } from "@/lib/actions/auth";
import { isTrialExpired, trialDaysLeft } from "@/lib/trial";
import { logError } from "@/lib/log-error";

async function getOrganizationProfile(
  organizationId: string | null,
): Promise<(OrgProfile & { trialEndsAt: Date | null }) | null> {
  if (!organizationId) return null;
  try {
    const org = await withOrgContext(organizationId, (tx) =>
      tx.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, segment: true, city: true, state: true, trialEndsAt: true },
      }),
    );
    return org ?? null;
  } catch (err) {
    logError("layout: falha ao carregar perfil da organização", err, { organizationId });
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await getCurrentMembership().catch(() => null);
  const organizationId = membership?.organizationId ?? null;

  const [organization, isSuperAdmin, memberships] = await Promise.all([
    getOrganizationProfile(organizationId),
    isCurrentUserSuperAdmin().catch(() => false),
    getUserMemberships().catch(() => []),
  ]);

  if (!isSuperAdmin && organization && isTrialExpired(organization.trialEndsAt)) {
    return <TrialExpired signOutAction={signOut} />;
  }

  const trialDays = organization ? trialDaysLeft(organization.trialEndsAt) : null;
  const orgOptions: OrgMembership[] = memberships.map((m) => ({
    organizationId: m.organizationId,
    name: m.organization.name,
  }));

  return (
    <AppShell
      organization={organization}
      signOutAction={signOut}
      isSuperAdmin={isSuperAdmin}
      trialDaysLeft={trialDays}
      memberships={orgOptions}
      currentOrganizationId={organizationId}
    >
      {children}
    </AppShell>
  );
}
