"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { searchOpportunities, searchSpecificCompany, type SearchOutcome } from "@/lib/opportunity-engine/search";
import { getCurrentMembership } from "@/lib/auth/current-org";

// Redirects compartilhados pelos dois modos de busca (aberta e dirigida) —
// tudo que não depende de qual empresa foi buscada. "ok"/"empty" ficam de
// fora: cada chamador trata esses dois com a mensagem certa pro seu modo.
function redirectForCommonOutcome(result: Exclude<SearchOutcome, { status: "ok" } | { status: "empty" }>): never {
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
  redirect(`/oportunidades?search=error&message=${encodeURIComponent(result.message)}`);
}

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

  if (result.status === "empty") {
    redirect("/oportunidades?search=empty");
  }
  if (result.status === "ok") {
    redirect(`/oportunidades?search=ok&count=${result.count}`);
  }
  redirectForCommonOutcome(result);
}

// Busca dirigida — mesma cota/cooldown/crédito da busca aberta (ver
// searchSpecificCompany em search.ts), só muda a mensagem de volta pra
// mencionar a empresa que o cliente pediu.
export async function runTargetedSearchAction(formData: FormData) {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/onboarding");
  }
  if (membership.searchBlocked) {
    redirect("/oportunidades?search=user_blocked");
  }

  const companyName = String(formData.get("companyName") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!companyName) {
    redirect(`/oportunidades?search=error&message=${encodeURIComponent("Digite o nome da empresa que você quer buscar.")}`);
  }

  const result = await searchSpecificCompany(membership.organizationId, companyName, location);
  revalidatePath("/");
  revalidatePath("/oportunidades");

  if (result.status === "empty") {
    redirect(`/oportunidades?search=targeted_empty&company=${encodeURIComponent(companyName)}`);
  }
  if (result.status === "ok") {
    redirect(`/oportunidades?search=targeted_ok&company=${encodeURIComponent(companyName)}`);
  }
  redirectForCommonOutcome(result);
}
