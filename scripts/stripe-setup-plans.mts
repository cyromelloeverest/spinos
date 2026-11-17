/**
 * Cria (ou reaproveita, por lookup_key) os Prices dos planos e da implantação no Stripe da chave em uso.
 * Rodar de novo no modo live antes de aceitar pagamento real: o script imprime os IDs para colar em src/lib/plans.ts.
 *   npx tsx --env-file=.env scripts/stripe-setup-plans.mts
 */
import Stripe from "stripe";
import { PLANS, SETUP_FEE_BRL } from "../src/lib/plans";
import { CREDIT_PACK } from "../src/lib/credit-pack";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const out: Record<string, string> = {};

async function priceFor(lookupKey: string, create: () => Promise<Stripe.Price>) {
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  return found.data[0] ?? (await create());
}

// Reaproveita o produto do preço antigo quando ele existe (modo teste); no modo live esse preço não existe
// e o produto é criado do zero. A conta é a da chave em uso.
async function productFor(legacyPriceId: string | undefined, name: string): Promise<string> {
  if (legacyPriceId) {
    try {
      const old = await stripe.prices.retrieve(legacyPriceId);
      const id = typeof old.product === "string" ? old.product : old.product.id;
      await stripe.products.update(id, { name });
      return id;
    } catch (err) {
      if ((err as { code?: string }).code !== "resource_missing") throw err;
    }
  }
  const found = await stripe.products.search({ query: `name:"${name}" AND active:"true"`, limit: 1 });
  return found.data[0]?.id ?? (await stripe.products.create({ name })).id;
}

for (const plan of Object.values(PLANS)) {
  const productId = await productFor(plan.legacyStripePriceIds[0], `Spinos ${plan.name}`);
  const price = await priceFor(`spinos_${plan.id.toLowerCase()}_mensal_v2`, () =>
    stripe.prices.create({ product: productId, currency: "brl", unit_amount: plan.priceMonthlyBRL * 100, recurring: { interval: "month" }, lookup_key: `spinos_${plan.id.toLowerCase()}_mensal_v2` }),
  );
  out[plan.id] = price.id;
}

const setup = await priceFor("spinos_implantacao_v1", async () => {
  const product = await stripe.products.create({ name: "Spinos — Implantação" });
  return stripe.prices.create({ product: product.id, currency: "brl", unit_amount: SETUP_FEE_BRL * 100, lookup_key: "spinos_implantacao_v1" });
});
out.SETUP = setup.id;

const creditProduct = await productFor(CREDIT_PACK.stripePriceId, "Pacote de buscas extras — Spinos");
const credits = await priceFor("spinos_creditos_5_v1", () =>
  stripe.prices.create({ product: creditProduct, currency: "brl", unit_amount: CREDIT_PACK.priceBRL * 100, lookup_key: "spinos_creditos_5_v1" }),
);
out.CREDITS = credits.id;
console.log(JSON.stringify(out, null, 2));
