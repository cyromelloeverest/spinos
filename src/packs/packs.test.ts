import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NichePackSchema } from "./schema";
import { getPack, listPacks, renderMessage } from "./registry";

describe("pacotes de nicho", () => {
  it("todo pacote registrado é válido e tem os tipos de etapa que o CRM exige", () => {
    for (const { key } of listPacks()) {
      const pack = getPack(key)!;
      expect(pack.key).toBe(key);
      const kinds = new Set(pack.pipeline.stages.map((s) => s.kind));
      expect(kinds).toEqual(new Set(["OPEN", "WON", "LOST"]));
    }
  });

  it("rejeita pacote quebrado: variável desconhecida, etapa inexistente, automação inválida", () => {
    const base = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "contabilidade/pack.json"), "utf8"));
    const bad = (mutate: (p: typeof base) => void) => {
      const p = structuredClone(base);
      mutate(p);
      return NichePackSchema.safeParse(p);
    };
    expect(bad((p) => (p.messages[0].body = "Oi {{cpf}}")).success).toBe(false);
    expect(bad((p) => (p.messages[0].stageKeys = ["NAO_EXISTE"])).success).toBe(false);
    expect(bad((p) => (p.automations.no_next_step.config = { afterDays: 0 })).success).toBe(false);
    expect(bad((p) => (p.automations.inventada = { enabled: true, config: {} })).success).toBe(false);
    expect(bad((p) => (p.pipeline.stages = p.pipeline.stages.filter((s: { kind: string }) => s.kind !== "LOST"))).success).toBe(false);
    expect(bad(() => {}).success).toBe(true);
  });

  it("contabilidade: mensagens, orientação e temas respeitam a NBC PG 01 (sem preço, sem promessa, sem comparação)", () => {
    const pack = getPack("contabilidade")!;
    const texts = [...pack.messages.map((m) => m.body), pack.searchGuidance.split(/Descreva a abordagem/)[0], ...pack.contentTopics.map((t) => `${t.title} ${t.angle}`)];
    const forbidden = /R\$|desconto|promoção|promocao|barato|menor preço|o melhor escritório|garantimos|garantia de|economia certa|sem custo/i;
    for (const t of texts) expect(t, t).not.toMatch(forbidden);
    // Toda mensagem de abordagem a quem nunca falou conosco permite pedir para não receber contato.
    const firstContact = pack.messages.filter((m) => ["primeiro_contato_empresa_nova", "primeiro_contato_crescimento", "follow_up_sem_resposta", "retomada_perdido"].includes(m.key));
    expect(firstContact).toHaveLength(4);
    for (const m of firstContact) expect(m.body, m.key).toMatch(/não receber|não voltar|deixo você em paz|não volto/i);
    expect(pack.contentRules.join(" ")).toMatch(/NBC PG 01/);
    expect(pack.contentRules.join(" ")).toMatch(/CRC/);
  });

  it("automações recomendadas do pacote de contabilidade", () => {
    const a = getPack("contabilidade")!.automations;
    expect(a.lead_response.enabled).toBe(true);
    expect(a.lead_distribution.enabled).toBe(false); // o rodízio precisa da equipe escolhida
    expect((a.proposal_followup.config as { stageKeys: string[] }).stageKeys).toEqual(["PROPOSTA"]);
  });
});

describe("renderMessage", () => {
  it("preenche as variáveis e deixa o buraco visível quando falta o valor", () => {
    expect(renderMessage("Olá, {{nome}}! {{ empresa }} / {{seu_nome}}", { nome: "Ana", empresa: "Padaria Sol", seu_nome: "" })).toBe("Olá, Ana! Padaria Sol / {{seu_nome}}");
  });
});

describe("regra de nicho no código", () => {
  it("nenhuma palavra de nicho aparece no código fora de src/packs (entrar em nicho novo = criar um pacote)", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (["packs", "generated", "node_modules"].includes(entry.name)) continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
          const text = fs.readFileSync(full, "utf8");
          if (/contábil|contabil|contabilidade|\bcontadores\b/i.test(text)) hits.push(path.relative(root, full));
        }
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
