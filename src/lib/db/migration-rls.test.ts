import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { analyzeMigrations, findRlsViolations } from "./migration-rls";

const POLICY = `CREATE POLICY tenant_isolation ON "t" USING ("organizationId" = current_setting('app.current_org_id', true)) WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));`;

describe("findRlsViolations (lógica)", () => {
  it("aceita tabela de tenant com RLS e policy por organização", () => {
    const t = analyzeMigrations([`CREATE TABLE "t" (\n  "id" TEXT NOT NULL,\n  "organizationId" TEXT NOT NULL\n);\nALTER TABLE "t" ENABLE ROW LEVEL SECURITY;\n${POLICY}`]);
    expect(findRlsViolations(t)).toEqual([]);
  });
  it("reprova tabela de tenant sem RLS", () => {
    const t = analyzeMigrations([`CREATE TABLE "t" (\n  "organizationId" TEXT NOT NULL\n);`]);
    expect(findRlsViolations(t).map((v) => v.problem)).toContain("RLS não está habilitada");
  });
  it("reprova tabela com organizationId, RLS ligada e sem policy", () => {
    const t = analyzeMigrations([`CREATE TABLE "t" (\n  "organizationId" TEXT NOT NULL\n);\nALTER TABLE "t" ENABLE ROW LEVEL SECURITY;`]);
    expect(findRlsViolations(t)).toHaveLength(1);
  });
  it("reprova policy que não usa o contexto da organização", () => {
    const t = analyzeMigrations([`CREATE TABLE "t" (\n  "organizationId" TEXT NOT NULL\n);\nALTER TABLE "t" ENABLE ROW LEVEL SECURITY;\nCREATE POLICY p ON "t" USING (true);`]);
    expect(findRlsViolations(t)).toHaveLength(1);
  });
  it("entende renomear, apagar e laço em bloco DO", () => {
    const t = analyzeMigrations([
      `CREATE TABLE "a" (\n  "organizationId" TEXT\n);\nCREATE TABLE "b" (\n  "organizationId" TEXT\n);\nCREATE TABLE "gone" (\n  "x" TEXT\n);`,
      `ALTER TABLE "a" RENAME TO "a2";\nDROP TABLE "gone";\nDO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['a2','b'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.current_org_id'', true))', t); END LOOP; END $$;`,
    ]);
    expect([...t.keys()].sort()).toEqual(["a2", "b"]);
    expect(findRlsViolations(t)).toEqual([]);
  });
});

describe("migrações reais do Spinos", () => {
  const dir = path.resolve(import.meta.dirname, "../../../prisma/migrations");
  const files = fs
    .readdirSync(dir)
    .filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
    .sort()
    .map((d) => fs.readFileSync(path.join(dir, d, "migration.sql"), "utf8"));

  it("toda tabela tem RLS e toda tabela de cliente isola por organização", () => {
    const tables = analyzeMigrations(files);
    expect(tables.size).toBeGreaterThan(10);
    expect(findRlsViolations(tables)).toEqual([]);
  });
});
