"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { searchOpportunities } from "@/lib/opportunity-engine/search";
import { getCurrentMembership } from "@/lib/auth/current-org";

export async function runSearchAction() {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/onboarding");
  }
  if (membership.searchBlocked) {
    redirect("/oportunidades?search=user_blocked");
  }

  const result = await searchOpportunities(membership.organizationId);
  revalidatePath("/");
  revalidatePath("/oportunidades");

  if (result.status === "not_configured") {
    redirect("/oportunidades?search=not_configured");
  }
  if (result.status === "rate_limited") {
    redirect(`/oportunidades?search=rate_limited&nextAt=${encodeURIComponent(result.nextAvailableAt)}`);
  }
  if (result.status === "plan_limit") {
    redirect(`/oportunidades?search=plan_limit&limit=${result.limit}`);
  }
  if (result.status === "search_limit") {
    redirect(`/oportunidades?search=search_limit&limit=${result.limit}`);
  }
  if (result.status === "error") {
    redirect(`/oportunidades?search=error&message=${encodeURIComponent(result.message)}`);
  }
  if (result.status === "empty") {
    redirect("/oportunidades?search=empty");
  }
  redirect(`/oportunidades?search=ok&count=${result.count}`);
}
