import { describe, expect, it } from "vitest";
import { formatLocation } from "./format-location";

describe("formatLocation", () => {
  it("junta cidade e estado quando os dois existem", () => {
    expect(formatLocation("Jundiaí", "SP")).toBe("Jundiaí, SP");
  });

  it("mostra só a cidade quando o estado não foi confirmado", () => {
    expect(formatLocation("Jundiaí", null)).toBe("Jundiaí");
  });

  it("mostra só o estado quando a cidade não foi confirmada", () => {
    expect(formatLocation(null, "SP")).toBe("SP");
  });

  it("avisa que a localização não foi confirmada quando os dois são null", () => {
    expect(formatLocation(null, null)).toBe("Localização não confirmada");
  });
});
