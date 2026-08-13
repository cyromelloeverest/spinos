// Pacote único de buscas extras avulsas — preço inicial, ajustável depois de
// olhar dado real (mesmo espírito dos tetos de trial em src/lib/trial.ts).
// Criado via Stripe API (produto "Pacote de buscas extras — Spinos"), não
// pelo dashboard — mesmo padrão dos 3 planos em src/lib/plans.ts.
export const SEARCH_CREDIT_PACK = {
  quantity: 5,
  priceBRL: 149,
  stripePriceId: "price_1U3mzBEqWpT7TrUVvxQSFwA2",
};
