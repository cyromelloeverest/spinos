import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Client separado, só pro painel /admin e pro que o super-admin precisa
// consultar entre organizações (algo que uma conexão com RLS de tenant
// nunca deveria conseguir por natureza). Hoje ADMIN_DATABASE_URL não
// existe como variável própria, então cai no mesmo DATABASE_URL de
// sempre — nenhuma mudança de comportamento. O objetivo desse arquivo
// existir agora é separar o código ANTES da troca de conexão de
// verdade: no dia em que o client principal (src/lib/prisma.ts) passar a
// usar uma role restrita por RLS, esse aqui continua exatamente como
// está, sem precisar tocar em admin.ts nem nas páginas de /admin.
const globalForPrismaAdmin = globalThis as unknown as { prismaAdmin?: PrismaClient };

const adapter = new PrismaPg({
  connectionString: process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL,
});

export const prismaAdmin = globalForPrismaAdmin.prismaAdmin ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrismaAdmin.prismaAdmin = prismaAdmin;
