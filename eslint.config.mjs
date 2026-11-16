import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // Motor de sites portado do Everest Sites (em produção lá). As regras abaixo dão falso
  // positivo nele: headingTag() devolve o nome de uma tag ("h1"/"h2"), não um componente; o
  // consentimento de cookies lê o navegador num efeito de propósito; e o link "/" do 404 é a
  // raiz do site do cliente, não uma rota da plataforma.
  {
    files: ["src/components/sites/**", "src/app/(sites)/**"],
    rules: {
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
