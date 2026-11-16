// Reconstrói, só lendo o SQL das migrações, o estado final de RLS de cada
// tabela. Serve ao teste que impede alguém de criar uma tabela de cliente sem
// isolamento por organização. Não consulta banco nenhum.

export type TableRls = {
  name: string;
  hasOrganizationId: boolean;
  rlsEnabled: boolean;
  policies: string[]; // expressões completas das policies (texto bruto)
};

const IDENT = String.raw`"?([A-Za-z_][A-Za-z0-9_]*)"?`;

export function analyzeMigrations(sqlFilesInOrder: string[]): Map<string, TableRls> {
  const tables = new Map<string, TableRls>();
  const get = (name: string) => tables.get(name);

  for (const raw of sqlFilesInOrder) {
    // Tira comentários de linha para não casar texto de comentário como SQL.
    const sql = raw.replace(/--.*$/gm, "");

    for (const m of sql.matchAll(new RegExp(String.raw`CREATE TABLE ${IDENT}\s*\(([\s\S]*?)\n\);`, "gi"))) {
      tables.set(m[1], { name: m[1], hasOrganizationId: /"organizationId"/.test(m[2]), rlsEnabled: false, policies: [] });
    }
    for (const m of sql.matchAll(new RegExp(String.raw`ALTER TABLE ${IDENT} ADD COLUMN\s+"organizationId"`, "gi"))) {
      const t = get(m[1]);
      if (t) t.hasOrganizationId = true;
    }
    for (const m of sql.matchAll(new RegExp(String.raw`ALTER TABLE ${IDENT} RENAME TO ${IDENT}`, "gi"))) {
      const t = get(m[1]);
      if (t) {
        tables.delete(m[1]);
        tables.set(m[2], { ...t, name: m[2] });
      }
    }
    for (const m of sql.matchAll(new RegExp(String.raw`ALTER TABLE ${IDENT} ENABLE ROW LEVEL SECURITY`, "gi"))) {
      const t = get(m[1]);
      if (t) t.rlsEnabled = true;
    }
    // Laço em bloco DO: FOREACH t IN ARRAY ARRAY['a','b'] ... ENABLE ROW LEVEL SECURITY ... CREATE POLICY
    for (const m of sql.matchAll(/FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\[([^\]]+)\][\s\S]*?END LOOP/gi)) {
      const names = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      const enables = /ENABLE ROW LEVEL SECURITY/i.test(m[0]);
      const policy = m[0].match(/CREATE POLICY[\s\S]*?current_setting\([^)]*\)/i)?.[0];
      for (const n of names) {
        const t = get(n);
        if (!t) continue;
        if (enables) t.rlsEnabled = true;
        if (policy) t.policies.push(policy);
      }
    }
    for (const m of sql.matchAll(new RegExp(String.raw`CREATE POLICY\s+\S+\s+ON ${IDENT}([\s\S]*?);`, "gi"))) {
      const t = get(m[1]);
      if (t) t.policies.push(m[0]);
    }
    for (const m of sql.matchAll(new RegExp(String.raw`DROP TABLE ${IDENT}`, "gi"))) tables.delete(m[1]);
  }
  return tables;
}

// Tabelas que de propósito não têm policy (só o papel administrativo acessa; o
// papel restrito não vê nada por padrão).
export const ADMIN_ONLY_TABLES = new Set(["auth_attempts", "security_events"]);

export type RlsViolation = { table: string; problem: string };

export function findRlsViolations(tables: Map<string, TableRls>): RlsViolation[] {
  const out: RlsViolation[] = [];
  for (const t of tables.values()) {
    if (!t.rlsEnabled) out.push({ table: t.name, problem: "RLS não está habilitada" });
    if (t.hasOrganizationId && !ADMIN_ONLY_TABLES.has(t.name) && !t.policies.some((p) => /current_org_id/.test(p))) {
      out.push({ table: t.name, problem: 'tem "organizationId" mas nenhuma policy usa app.current_org_id' });
    }
  }
  return out;
}
