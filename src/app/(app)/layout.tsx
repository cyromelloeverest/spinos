import { type OrgProfile } from "@/components/Rail";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { signOut } from "@/lib/actions/auth";

async function getCurrentOrganization(): Promise<OrgProfile> {
  try {
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) return null;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, segment: true, city: true, state: true },
    });
    return org ?? null;
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const organization = await getCurrentOrganization();

  return (
    <AppShell organization={organization} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
