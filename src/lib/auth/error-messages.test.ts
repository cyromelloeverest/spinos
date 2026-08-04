import { describe, expect, it } from "vitest";
import { translateAuthError } from "./error-messages";

describe("translateAuthError", () => {
  it("traduz a mensagem mais comum: credenciais inválidas no login", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("E-mail ou senha incorretos.");
  });

  it("é case-insensitive (o Supabase não garante capitalização estável)", () => {
    expect(translateAuthError("invalid login credentials")).toBe("E-mail ou senha incorretos.");
  });

  it("traduz e-mail não confirmado", () => {
    expect(translateAuthError("Email not confirmed")).toContain("Confirme seu e-mail");
  });

  it("traduz usuário já cadastrado", () => {
    expect(translateAuthError("User already registered")).toContain("já tem uma conta");
  });

  it("traduz senha curta mesmo com o número variando (ex: 'at least 6 characters')", () => {
    expect(translateAuthError("Password should be at least 6 characters.")).toContain("pelo menos 6 caracteres");
  });

  it("traduz link/token expirado", () => {
    expect(translateAuthError("Token has expired or is invalid")).toContain("expirou");
  });

  it("nunca deixa uma mensagem em inglês vazar — cai num fallback em português pra qualquer mensagem desconhecida", () => {
    const result = translateAuthError("Some brand new Supabase error message nobody mapped yet");
    expect(result).toBe("Não foi possível completar essa ação. Tente novamente em instantes.");
  });

  it("fallback também cobre string vazia", () => {
    expect(translateAuthError("")).toBe("Não foi possível completar essa ação. Tente novamente em instantes.");
  });
});
