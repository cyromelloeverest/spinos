/** Domínio pai dos endereços provisórios, ex.: padaria-sol.sites.spinos.com.br. */
export function platformDomain(): string {
  return process.env.SITES_PLATFORM_DOMAIN ?? "sites.spinos.com.br";
}

/** Domínios que são da plataforma (não de site de cliente): o app, o apex e aliases. */
export function platformHosts(): string[] {
  return ["app.spinos.com.br", "www.app.spinos.com.br", "spinos.com.br", "www.spinos.com.br", "localhost", "127.0.0.1"];
}

/**
 * Chave do identificador diário anônimo do visitante. Se faltar, volta para o segredo do
 * cron (que também só a plataforma conhece), para o identificador nunca poder ser
 * recalculado a partir de um IP por quem está de fora.
 */
export function analyticsKey(): string | undefined {
  return process.env.SITES_IP_SALT || process.env.CRON_SECRET || undefined;
}
