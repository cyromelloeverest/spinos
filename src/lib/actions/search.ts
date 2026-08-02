"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { searchOpportunities } from "@/lib/opportunity-engine/search";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";

export async function runSearchAction() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    redirect("/onboarding");
  }

  const result = await searchOpportunities(organizationId);
  revalidatePath("/");
  revalidatePath("/oportunidades");

  if (result.status === "not_configured") {
    redirect("/oportunidades?search=not_configured");
  }
  if (result.status === "rate_limited") {
    redirect(`/oportunidades?search=rate_limited&nextAt=${encodeURIComponent(result.nextAvailableAt)}`);
  }
  if (result.status === "error") {
    redirect(`/oportunidades?search=error&message=${encodeURIComponent(result.message)}`);
  }
  redirect(`/oportunidades?search=ok&count=${result.count}`);
}
