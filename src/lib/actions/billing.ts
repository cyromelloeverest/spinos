"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/auth/current-org";
import { getPlan } from "@/lib/plans";
import { SITE_URL } from "@/lib/site-url";
import { stripe } from "@/lib/stripe";

async function requireOwnerOrAdmin() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    redirect("/settings/empresa?error=Apenas donos e administradores podem gerenciar a assinatura.");
  }
  return membership;
}

async function getOrCreateStripeCustomer(organizationId: string): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { organizationId },
  });
  await prisma.organization.update({ where: { id: organizationId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(planId: string) {
  const membership = await requireOwnerOrAdmin();
  const plan = getPlan(planId);
  const customerId = await getOrCreateStripeCustomer(membership.organizationId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${SITE_URL}/settings/empresa?assinatura=sucesso`,
    cancel_url: `${SITE_URL}/settings/empresa?assinatura=cancelado`,
    subscription_data: {
      metadata: { organizationId: membership.organizationId, planId: plan.id },
    },
  });

  if (!session.url) {
    redirect("/settings/empresa?error=Não foi possível iniciar o checkout. Tente novamente.");
  }
  redirect(session.url);
}

export async function createPortalSession() {
  const membership = await requireOwnerOrAdmin();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: membership.organizationId } });

  if (!org.stripeCustomerId) {
    redirect("/settings/empresa?error=Você ainda não tem uma assinatura ativa.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${SITE_URL}/settings/empresa`,
  });

  redirect(session.url);
}
