import { NichePackSchema, type NichePack } from "./schema";
import contabilidade from "./contabilidade/pack.json";
import geral from "./geral/pack.json";

// Todo pacote é validado ao carregar: um pack.json quebrado derruba o build (pelo teste)
// em vez de quebrar um cliente em produção.
const PACKS: Record<string, NichePack> = {
  geral: NichePackSchema.parse(geral),
  contabilidade: NichePackSchema.parse(contabilidade),
};

export const DEFAULT_PACK_KEY = "geral";

export function getPack(key: string | null | undefined): NichePack | null {
  return key && Object.hasOwn(PACKS, key) ? PACKS[key] : null;
}

export function listPacks(): { key: string; name: string; description: string }[] {
  return Object.values(PACKS).map((p) => ({ key: p.key, name: p.name, description: p.description }));
}

// Preenche as variáveis de uma mensagem. Variável sem valor fica como veio (mostra o
// buraco para a pessoa preencher), nunca vira "undefined".
export function renderMessage(body: string, values: Partial<Record<"nome" | "empresa" | "escritorio" | "seu_nome", string | null | undefined>>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, name: string) => {
    const v = values[name as keyof typeof values];
    return v && v.trim() ? v.trim() : whole;
  });
}
