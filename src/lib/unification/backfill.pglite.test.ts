import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createMigratedDb } from "@/lib/db/pglite-harness";
import { runBackfill } from "./backfill-sql";

let db: PGlite;
const T0 = "2026-10-01T00:00:00Z";
const T1 = "2026-10-05T00:00:00Z";

async function count(table: string, where = "true") {
  return ((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`)).rows[0] as { n: number }).n;
}

async function addScore(o: {
  id: string; org: string; company: string; stage?: string | null; status?: string;
  contactName?: string | null; contactPhone?: string | null; decisionMakerName?: string | null; decisionMaker?: string | null; at?: string;
}) {
  await db.query(
    `INSERT INTO opportunity_scores (id, "organizationId", "companyId", "icpId", score, urgency, headline, "execSummary", reasoning, "suggestedApproach",
       "commercialArguments", objections, status, stage, "stageUpdatedAt", "contactName", "contactPhone", "decisionMakerName", "decisionMaker", "computedAt")
     VALUES ($1,$2,$3,$4,80,'ALTA',$5,'x','x','x', ARRAY[]::text[], ARRAY[]::text[], $6::"OpportunityStatus", $7::"PipelineStage", $8, $9, $10, $11, $12, $13)`,
    [o.id, o.org, o.company, `icp-${o.org}`, `Manchete ${o.id}`, o.status ?? "NEW", o.stage ?? null, o.stage ? T1 : null,
      o.contactName ?? null, o.contactPhone ?? null, o.decisionMakerName ?? null, o.decisionMaker ?? null, o.at ?? T0],
  );
}

beforeAll(async () => {
  db = await createMigratedDb();
  for (const org of ["org1", "org2"]) {
    await db.query(`INSERT INTO organizations (id, name, "updatedAt") VALUES ($1, $1, $2)`, [org, T0]);
    await db.query(`INSERT INTO icps (id, "organizationId", "updatedAt") VALUES ($1, $2, $3)`, [`icp-${org}`, org, T0]);
  }
  for (const c of ["c1", "c2", "c3", "c4"]) {
    await db.query(`INSERT INTO companies (id, name, cnpj, "updatedAt") VALUES ($1, $2, $3, $4)`, [c, `Empresa ${c}`, `000000000000${c.slice(1)}`.slice(-14), T0]);
  }
  await addScore({ id: "s1", org: "org1", company: "c1", stage: "VENDIDO", contactName: "Ana", contactPhone: "11999990000" });
  await addScore({ id: "s2", org: "org1", company: "c2", status: "DISMISSED" });
  await addScore({ id: "s3", org: "org1", company: "c3", stage: "CONTATO_FEITO", decisionMakerName: "Carlos Souza", decisionMaker: "Diretor" });
  await addScore({ id: "s4", org: "org2", company: "c1", stage: "PERDIDO" });
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("cópia do modelo antigo para o unificado", () => {
  it("cria funil, etapas, contas, contatos, oportunidades e origem a partir das notas", async () => {
    await runBackfill((sql) => db.exec(sql));

    expect(await count("pipelines", `"isDefault"`)).toBe(2);
    expect(await count("stages")).toBe(10);
    expect(await count("accounts")).toBe(4);
    expect(await count("opportunity_scores", `"accountId" IS NULL`)).toBe(0);

    const life = (await db.query(`SELECT a."organizationId" o, c.name n, a.lifecycle l FROM accounts a JOIN companies c ON c.id = a."companyId" ORDER BY 1, 2`)).rows as { o: string; n: string; l: string }[];
    expect(life.map((r) => `${r.o}/${r.n}/${r.l}`)).toEqual([
      "org1/Empresa c1/CUSTOMER", "org1/Empresa c2/DISMISSED", "org1/Empresa c3/ENGAGED", "org2/Empresa c1/LOST",
    ]);

    // contato principal (Ana) + decisor (Carlos)
    expect(await count("contacts")).toBe(2);
    expect(await count("contacts", `"isPrimary" AND name = 'Ana'`)).toBe(1);
    expect(await count("contacts", `NOT "isPrimary" AND name = 'Carlos Souza' AND "decisionRole" = 'decisor' AND "jobTitle" = 'Diretor'`)).toBe(1);

    // 3 notas com etapa -> 3 oportunidades, nos tipos de etapa certos
    const opps = (await db.query(`SELECT o.status, s.key, o."closedAt" IS NOT NULL AS fechada FROM opportunities o JOIN stages s ON s.id = o."stageId" ORDER BY s.key`)).rows as { status: string; key: string; fechada: boolean }[];
    expect(opps).toEqual([
      { status: "OPEN", key: "CONTATO_FEITO", fechada: false },
      { status: "LOST", key: "PERDIDO", fechada: true },
      { status: "WON", key: "VENDIDO", fechada: true },
    ]);
    expect(await count("opportunity_stage_events")).toBe(3);
    expect(await count("opportunities", `"primaryContactId" IS NOT NULL`)).toBe(1);

    expect(await count("origins", `kind = 'PROSPECTING' AND "isFirstTouch"`)).toBe(4);
  });

  it("é seguro repetir: rodar de novo não duplica nada", async () => {
    const before = await Promise.all(["pipelines", "stages", "accounts", "contacts", "opportunities", "opportunity_stage_events", "origins"].map((t) => count(t)));
    await runBackfill((sql) => db.exec(sql));
    const after = await Promise.all(["pipelines", "stages", "accounts", "contacts", "opportunities", "opportunity_stage_events", "origins"].map((t) => count(t)));
    expect(after).toEqual(before);
  });

  it("pega só o que é novo: uma nota criada depois da primeira cópia entra na segunda", async () => {
    await addScore({ id: "s5", org: "org2", company: "c4", stage: "PROPOSTA_ENVIADA", at: T1 });
    await runBackfill((sql) => db.exec(sql));
    expect(await count("accounts")).toBe(5);
    expect(await count("opportunities")).toBe(4);
    expect(await count("origins")).toBe(5);
    expect(await count("opportunity_scores", `"accountId" IS NULL`)).toBe(0);
  });

  it("não mistura organizações: a mesma empresa vira contas diferentes em cada organização", async () => {
    const r = (await db.query(`SELECT count(DISTINCT "organizationId")::int n FROM accounts WHERE "companyId" = 'c1'`)).rows[0] as { n: number };
    expect(r.n).toBe(2);
  });
});
