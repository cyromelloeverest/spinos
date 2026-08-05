import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS e Permissions-Policy também aqui (não só no middleware) pra
          // cobrir _next/static/_next/image/favicon, que o matcher do
          // middleware (src/proxy.ts) pula. CSP fica só no middleware — é
          // dinâmica (nonce por request) e duplicar aqui geraria dois headers
          // Content-Security-Policy na mesma resposta em rotas de página.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
