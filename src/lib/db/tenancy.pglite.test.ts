import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createMigratedDb, asOrg } from "./pglite-harness";

let db: PGlite;
const NOW = "2026-11-16T00:00:00Z";

async function seed() {
  for (const id of ["orgA", "orgB"]) {
    await db.query(`INSERT INTO organizations (id, name, "updatedAt") VALUES ($1, $1, $2)`, [id, NOW]);
    await db.query(`INSERT INTO pipelines (id, "organizationId", name) VALUES ($1, $2, 'Geral')`, [`pipe-${id}`, id]);
    await db.query(`INSERT INTO stages (id, "organizationId", "pipelineId", key, name, position, kind) VALUES ($1, $2, $3, 'novo', 'Novo', 0, 'OPEN')`, [`stage-${id}`, id, `pipe-${id}`]);
    await db.query(`INSERT INTO accounts (id, "organizationId", name, "updatedAt") VALUES ($1, $2, $3, $4)`, [`acc-${id}`, id, `Conta ${id}`, NOW]);
    await db.query(`INSERT INTO contacts (id, "organizationId", "accountId", name, "updatedAt") VALUES ($1, $2, $3, $4, $5)`, [`ct-${id}`, id, `acc-${id}`, `Contato ${id}`, NOW]);
  }
}

beforeAll(async () => {
  db = await createMigratedDb();
  await seed();
}, 60_000);

afterAll(async () => {
  await db.close();
});

const TENANT_TABLES = ["accounts", "contacts", "pipelines", "stages"];

describe("RLS: cada organização só enxerga o que é seu", () => {
  for (const table of TENANT_TABLES) {
    it(`${table}: a organização A não vê linhas da B`, async () => {
      const rows = await asOrg(db, "orgA", async (q) => (await q<{ organizationId: string }>(`SELECT "organizationId" FROM ${table}`)).rows);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organizationId === "orgA")).toBe(true);
    });
  }

  it("controle: quem ignora RLS (superusuário) enxerga as duas organizações, então o isolamento vem mesmo da RLS", async () => {
    const r = await db.query(`SELECT count(DISTINCT "organizationId")::int AS n FROM accounts`);
    expect((r.rows[0] as { n: number }).n).toBe(2);
  });

  it("sem contexto de organização, o papel restrito não enxerga nada", async () => {
    await db.exec("BEGIN");
    try {
      await db.exec("SET LOCAL ROLE spinos_app");
      const r = await db.query(`SELECT count(*)::int AS n FROM accounts`);
      expect((r.rows[0] as { n: number }).n).toBe(0);
    } finally {
      await db.exec("ROLLBACK");
    }
  });

  it("não deixa gravar um registro com o organizationId de outra organização", async () => {
    await expect(
      asOrg(db, "orgA", (q) => q(`INSERT INTO accounts (id, "organizationId", name, "updatedAt") VALUES ('x', 'orgB', 'invasora', $1)`, [NOW])),
    ).rejects.toThrow(/row-level security/i);
  });

  it("não deixa a organização A alterar a conta da B", async () => {
    const updated = await asOrg(db, "orgA", async (q) => (await q(`UPDATE accounts SET name = 'hackeada' WHERE id = 'acc-orgB'`)).affectedRows);
    expect(updated).toBe(0);
  });
});

describe("chave composta: o filho nunca aponta para o pai de outra organização (vale até para quem ignora RLS)", () => {
  it("contato da A não pode ser ligado à conta da B", async () => {
    await expect(
      db.query(`INSERT INTO contacts (id, "organizationId", "accountId", name, "updatedAt") VALUES ('cx', 'orgA', 'acc-orgB', 'x', $1)`, [NOW]),
    ).rejects.toThrow(/foreign key/i);
  });

  it("oportunidade da A não pode usar etapa da B", async () => {
    await expect(
      db.query(
        `INSERT INTO opportunities (id, "organizationId", "accountId", "pipelineId", "stageId", title, "updatedAt") VALUES ('ox', 'orgA', 'acc-orgA', 'pipe-orgA', 'stage-orgB', 't', $1)`,
        [NOW],
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("oportunidade da A não pode apontar para a conta da B", async () => {
    await expect(
      db.query(
        `INSERT INTO opportunities (id, "organizationId", "accountId", "pipelineId", "stageId", title, "updatedAt") VALUES ('oy', 'orgA', 'acc-orgB', 'pipe-orgA', 'stage-orgA', 't', $1)`,
        [NOW],
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("a mesma organização consegue criar a oportunidade normalmente", async () => {
    await db.query(
      `INSERT INTO opportunities (id, "organizationId", "accountId", "pipelineId", "stageId", title, "updatedAt") VALUES ('ok1', 'orgA', 'acc-orgA', 'pipe-orgA', 'stage-orgA', 't', $1)`,
      [NOW],
    );
    const r = await db.query(`SELECT count(*)::int AS n FROM opportunities WHERE id='ok1'`);
    expect((r.rows[0] as { n: number }).n).toBe(1);
  });
});
