"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/lib/auth/current-org";
import { getPlan } from "@/lib/plans";
import { SITE_URL } from "@/lib/site-url";
import { stripe } from "@/lib/stripe";
import { logError } from "@/lib/log-error";

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

  // redirect() nunca pode ficar dentro do try — ele funciona lançando uma
  // exceção especial que o Next reconhece, e um catch genérico aqui em cima
  // engoliria esse throw e quebraria o redirecionamento normal de sucesso.
  let sessionUrl: string | null = null;
  try {
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
    sessionUrl = session.url;
  } catch (err) {
    logError("billing: falha ao criar checkout session", err, { organizationId: membership.organizationId, planId });
  }

  if (!sessionUrl) {
    redirect("/settings/empresa?error=Não foi possível iniciar o checkout. Tente novamente.");
  }
  redirect(sessionUrl);
}

export async function createPortalSession() {
  const membership = await requireOwnerOrAdmin();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: membership.organizationId } });

  if (!org.stripeCustomerId) {
    redirect("/settings/empresa?error=Você ainda não tem uma assinatura ativa.");
  }

  let sessionUrl: string | null = null;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${SITE_URL}/settings/empresa`,
    });
    sessionUrl = session.url;
  } catch (err) {
    logError("billing: falha ao criar portal session", err, { organizationId: membership.organizationId });
  }

  if (!sessionUrl) {
    redirect("/settings/empresa?error=Não foi possível abrir o portal de assinatura. Tente novamente.");
  }
  redirect(sessionUrl);
}
