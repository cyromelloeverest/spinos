"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";

export async function updateContactInfo(opportunityScoreId: string, formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const contactName = String(formData.get("contactName") ?? "").trim() || null;
  const contactPhone = String(formData.get("contactPhone") ?? "").trim() || null;
  const contactEmail = String(formData.get("contactEmail") ?? "").trim() || null;
  const recommendedOffering = String(formData.get("recommendedOffering") ?? "").trim() || null;

  await withOrgContext(organizationId, (tx) =>
    tx.opportunityScore.update({
      where: { id: opportunityScoreId, organizationId },
      data: { contactName, contactPhone, contactEmail, recommendedOffering },
    }),
  );

  revalidatePath(`/company/${opportunityScoreId}`);
}
