import { Rail, type OrgProfile } from "@/components/Rail";
import { TopBar } from "@/components/TopBar";
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
    <div className="grid min-h-screen" style={{ gridTemplateColumns: "240px 1fr" }}>
      <Rail organization={organization} signOutAction={signOut} />
      <div className="min-w-0 flex flex-col">
        <TopBar organizationName={organization?.name ?? "Configurar empresa"} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
