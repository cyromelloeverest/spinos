import { describe, it, expect } from "vitest";
import { isBiddingEnabled } from "./gating";

describe("isBiddingEnabled", () => {
  it("fica bloqueado por padrão em todos os planos", () => {
    for (const plan of ["STARTER", "PROFISSIONAL", "ENTERPRISE"]) {
      expect(isBiddingEnabled({ plan, biddingEnabled: false })).toBe(false);
    }
  });
  it("libera quando a organização foi liberada manualmente", () => {
    expect(isBiddingEnabled({ plan: "STARTER", biddingEnabled: true })).toBe(true);
  });
  it("plano desconhecido não libera", () => {
    expect(isBiddingEnabled({ plan: "XYZ", biddingEnabled: false })).toBe(false);
  });
});
