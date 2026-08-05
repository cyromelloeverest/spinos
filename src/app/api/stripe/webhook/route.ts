import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getPlanByStripePriceId } from "@/lib/plans";

async function syncSubscription(customerId: string, subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? getPlanByStripePriceId(priceId) : null;

  await prisma.organization.update({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      // Se o preço não bate com nenhum plano conhecido (ex: preço criado
      // manualmente no dashboard), não mexe no plano — só sincroniza status.
      ...(plan ? { plan: plan.id, trialEndsAt: null } : {}),
    },
  });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: "Webhook não configurado (falta STRIPE_WEBHOOK_SECRET)." }, { status: 500 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assinatura inválida.";
    return Response.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription && session.customer) {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
        await syncSubscription(customerId, subscriptionId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      await syncSubscription(customerId, subscription.id);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      await prisma.organization.update({
        where: { stripeCustomerId: customerId },
        data: { subscriptionStatus: "canceled", stripeSubscriptionId: null },
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        await prisma.organization.update({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: "past_due" },
        });
      }
      break;
    }
    default:
      break;
  }

  return Response.json({ received: true });
}
