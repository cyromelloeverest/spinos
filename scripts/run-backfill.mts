// Copia o modelo antigo (OpportunityScore) para o unificado. NÃO roda sozinho em
// nenhum deploy: só quando alguém executa `npx tsx scripts/run-backfill.mts`.
// Seguro de repetir. Roda tudo numa transação: se um passo falhar, nada fica pela metade.
import "dotenv/config";
import { prismaAdmin } from "../src/lib/prisma-admin";
import { BACKFILL_STATEMENTS } from "../src/lib/unification/backfill-sql";

const before = async () =>
  Object.fromEntries(
    await Promise.all(
      ["pipelines", "stages", "accounts", "contacts", "opportunities", "opportunity_stage_events", "origins"].map(async (t) => [
        t,
        Number((await prismaAdmin.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) n from ${t}`))[0].n),
      ]),
    ),
  );

console.log("antes: ", await before());
await prismaAdmin.$transaction(async (tx) => {
  for (const step of BACKFILL_STATEMENTS) {
    const n = await tx.$executeRawUnsafe(step.sql);
    console.log(`- ${step.name}: ${n} linha(s)`);
  }
});
console.log("depois:", await before());
await prismaAdmin.$disconnect();
