import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
// prismaAdmin de propósito: webhook do Stripe não tem sessão de usuário —
// os lookups são por stripeCustomerId/checkout session, não por
// organizationId conhecido de antemão (exceto fulfillSearchCreditPurchase,
// que usa prismaAdmin também só por consistência com o resto do arquivo).
import { prismaAdmin } from "@/lib/prisma-admin";
import { getPlanByStripePriceId } from "@/lib/plans";
import { sendTrialCreditPurchaseAlert } from "@/lib/credit-alert-email";
import { logError } from "@/lib/log-error";

// Pagamento avulso de um pacote de buscas extras (mode: "payment", não
// "subscription" — ver purchaseSearchCredits em src/lib/actions/credits.ts).
// stripeCheckoutSessionId é único na tabela de propósito: o Stripe reenvia
// webhook em retry se não receber 200 rápido o bastante, e isso não pode
// creditar a mesma compra duas vezes.
async function fulfillSearchCreditPurchase(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const quantity = Number(session.metadata?.quantity ?? 0);
  if (!organizationId || !quantity) return;

  const already = await prismaAdmin.searchCreditPurchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (already) return;

  const amountBRL = Math.round((session.amount_total ?? 0) / 100);

  const organization = await prismaAdmin.organization.update({
    where: { id: organizationId },
    data: {
      searchCreditBalance: { increment: quantity },
      searchCreditPurchases: {
        create: { quantity, amountBRL, stripeCheckoutSessionId: session.id },
      },
    },
  });

  // Trial pagando por saldo antes de virar cliente pago de verdade = lead
  // quentíssimo, avisa o time comercial na hora.
  if (organization.trialEndsAt !== null) {
    await sendTrialCreditPurchaseAlert({
      organizationName: organization.name,
      organizationId: organization.id,
      quantity,
      amountBRL,
    }).catch((err) => logError("webhook: falha ao enviar alerta de compra de crédito em trial", err, { organizationId }));
  }
}

async function syncSubscription(customerId: string, subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? getPlanByStripePriceId(priceId) : null;

  await prismaAdmin.organization.update({
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
      } else if (session.mode === "payment" && session.metadata?.kind === "search_credit_pack") {
        await fulfillSearchCreditPurchase(session);
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
      await prismaAdmin.organization.update({
        where: { stripeCustomerId: customerId },
        data: { subscriptionStatus: "canceled", stripeSubscriptionId: null },
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        await prismaAdmin.organization.update({
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
