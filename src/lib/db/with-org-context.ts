import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Segunda camada de isolamento multi-tenant (defesa em profundidade além do
// filtro organizationId que toda query já faz). Abre uma transação curta,
// define app.current_org_id só nela (set_config com o terceiro argumento
// "true" = SET LOCAL, escopo de transação, não de sessão — necessário
// porque o pooler de transação da Supabase pode reciclar a conexão física
// entre statements fora de uma transação explícita), e roda a callback
// usando esse client transacional.
//
// Só tem efeito de verdade quando a conexão do Prisma usa uma role sem
// BYPASSRLS — até lá, é inofensivo (a role postgres ignora RLS de qualquer
// jeito, então isso só adiciona uma transação vazia por chamada).
//
// set_config($1) é parametrizado de verdade (tagged template do Prisma),
// não interpolação de string — nem um organizationId malicioso quebra isso.
export async function withOrgContext<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
    return fn(tx);
  });
}
