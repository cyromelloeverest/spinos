import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

// Postgres em memória (PGlite) com TODAS as migrações do Spinos aplicadas, para
// testar isolamento entre organizações com RLS de verdade, sem tocar no banco real.

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../../prisma/migrations");

export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite();
  // A migração que liga RLS em _prisma_migrations pressupõe a tabela de controle
  // do Prisma, que o PGlite não tem.
  await db.exec(`CREATE TABLE "_prisma_migrations" (id text primary key);`);
  const dirs = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((d) => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory())
    .sort();
  for (const d of dirs) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, d, "migration.sql"), "utf8");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Falha ao aplicar a migração ${d} no PGlite: ${(err as Error).message}`);
    }
  }
  // Papel restrito, como o do app em produção: sem superusuário e sem bypass de RLS.
  await db.exec(`
    CREATE ROLE spinos_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public TO spinos_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO spinos_app;
  `);
  return db;
}

// Roda `fn` como o papel restrito, já dentro do contexto da organização, como o
// withOrgContext faz no app. Reverte no fim (rollback) para não vazar estado.
export async function asOrg<T>(db: PGlite, organizationId: string, fn: (q: PGlite["query"]) => Promise<T>): Promise<T> {
  await db.exec("BEGIN");
  try {
    await db.exec("SET LOCAL ROLE spinos_app");
    await db.query(`SELECT set_config('app.current_org_id', $1, true)`, [organizationId]);
    return await fn(db.query.bind(db) as PGlite["query"]);
  } finally {
    await db.exec("ROLLBACK");
  }
}
