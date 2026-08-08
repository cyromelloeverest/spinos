"use server";

import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentMembership } from "@/lib/auth/current-org";
import { SITE_URL } from "@/lib/site-url";
import { stripe } from "@/lib/stripe";
import { logError } from "@/lib/log-error";
import { SEARCH_CREDIT_PACK } from "@/lib/search-credit-pack";

async function requireOwnerOrAdmin() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    redirect("/oportunidades?error=Apenas donos e administradores podem comprar buscas extras.");
  }
  return membership;
}

// Duplicado de src/lib/actions/billing.ts de propósito — mesmo helper,
// arquivo separado. Evita acoplar o fluxo de créditos avulsos ao de
// assinatura recorrente, que muda por conta própria com frequência.
async function getOrCreateStripeCustomer(organizationId: string): Promise<string> {
  const org = await withOrgContext(organizationId, (tx) =>
    tx.organization.findUniqueOrThrow({ where: { id: organizationId } }),
  );
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { organizationId },
  });
  await withOrgContext(organizationId, (tx) =>
    tx.organization.update({ where: { id: organizationId }, data: { stripeCustomerId: customer.id } }),
  );
  return customer.id;
}

// Disponível a qualquer momento (não só quando o limite já bateu) — o brief
// pede compra sem fricção, então não há nenhum gate de "só se estiver
// bloqueado" aqui. Quem decide se faz sentido comprar é o cliente.
export async function purchaseSearchCredits() {
  const membership = await requireOwnerOrAdmin();

  let sessionUrl: string | null = null;
  try {
    const customerId = await getOrCreateStripeCustomer(membership.organizationId);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: SEARCH_CREDIT_PACK.stripePriceId, quantity: 1 }],
      success_url: `${SITE_URL}/oportunidades?creditos=sucesso`,
      cancel_url: `${SITE_URL}/oportunidades?creditos=cancelado`,
      // Pagamento avulso não tem subscription_data — os metadados vão direto
      // na sessão, e é isso que o webhook lê em checkout.session.completed
      // pra saber que é compra de crédito (não assinatura) e de qual org.
      metadata: {
        organizationId: membership.organizationId,
        kind: "search_credit_pack",
        quantity: String(SEARCH_CREDIT_PACK.quantity),
      },
    });
    sessionUrl = session.url;
  } catch (err) {
    logError("credits: falha ao criar checkout session", err, { organizationId: membership.organizationId });
  }

  if (!sessionUrl) {
    redirect("/oportunidades?error=Não foi possível iniciar a compra. Tente novamente.");
  }
  redirect(sessionUrl);
}
