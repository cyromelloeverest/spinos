// Em produção na Vercel, essa variável já vem preenchida sozinha com o
// domínio de produção atual — mesmo depois de trocar pra um domínio próprio.
// NEXT_PUBLIC_SITE_URL só é necessária se quisermos forçar outra coisa.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ??
  "http://localhost:3000";
