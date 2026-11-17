import { withOrgContext } from "@/lib/db/with-org-context";
import { stripe } from "@/lib/stripe";

function isMissingCustomer(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "resource_missing";
}

// Cliente Stripe da organização. Separado em transações curtas (a chamada ao Stripe fica no meio).
// Confere se o id guardado ainda existe na conta/modo atual: um id criado em modo teste (ou apagado
// no Stripe) não existe no modo live e quebraria o checkout; nesse caso cria um novo e atualiza o registro.
export async function getOrCreateStripeCustomer(organizationId: string): Promise<string> {
  const org = await withOrgContext(organizationId, (tx) =>
    tx.organization.findUniqueOrThrow({ where: { id: organizationId } }),
  );

  if (org.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(org.stripeCustomerId);
      if (!existing.deleted) return org.stripeCustomerId;
    } catch (err) {
      if (!isMissingCustomer(err)) throw err;
    }
  }

  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { organizationId },
  });
  await withOrgContext(organizationId, (tx) =>
    tx.organization.update({ where: { id: organizationId }, data: { stripeCustomerId: customer.id } }),
  );
  return customer.id;
}
