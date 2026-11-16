"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { ensureAccountForCompany, savePrimaryContact } from "@/lib/crm/accounts";

export async function updateContactInfo(opportunityScoreId: string, formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const contactName = String(formData.get("contactName") ?? "").trim() || null;
  const contactPhone = String(formData.get("contactPhone") ?? "").trim() || null;
  const contactEmail = String(formData.get("contactEmail") ?? "").trim() || null;
  const recommendedOffering = String(formData.get("recommendedOffering") ?? "").trim() || null;

  await withOrgContext(organizationId, async (tx) => {
    const score = await tx.opportunityScore.findFirstOrThrow({
      where: { id: opportunityScoreId, organizationId },
      select: { id: true, companyId: true, accountId: true, computedAt: true },
    });
    const accountId = score.accountId ?? (await ensureAccountForCompany(tx, { organizationId, companyId: score.companyId, occurredAt: score.computedAt }));
    await tx.opportunityScore.update({ where: { id: score.id }, data: { accountId, recommendedOffering } });
    await savePrimaryContact(tx, { organizationId, accountId, name: contactName, phone: contactPhone, email: contactEmail });
  });

  revalidatePath(`/company/${opportunityScoreId}`);
}
