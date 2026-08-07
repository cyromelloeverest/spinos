import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // server-only só funciona dentro do bundler do Next (que o troca por
      // um no-op em código de servidor) — fora dele sempre lança erro, por
      // isso precisa desse alias vazio pro Vitest.
      "server-only": path.resolve(import.meta.dirname, "./src/lib/test/server-only-mock.ts"),
    },
  },
});
