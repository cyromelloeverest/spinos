import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/convite", "/aceitar-convite", "/api/auth/send-email", "/api/stripe/webhook", "/api/cron", "/api/lifecycle-emails/unsubscribe", "/manifest.webmanifest", "/privacidade", "/termos"];

// Nonce por request pra CSP. Next.js aplica esse nonce automaticamente aos
// scripts que ele mesmo injeta (RSC payload, hydration) quando detecta
// 'nonce-<valor>' no header Content-Security-Policy da resposta — não precisa
// tocar em layout.tsx. style-src precisa de 'unsafe-inline' porque o design
// system inteiro usa style={{ ... }} (atributo style inline do React), que
// nonce não cobre. img-src libera qualquer host https porque o Radar mostra
// og:image de sinais raspados de qualquer site de notícia/fonte pública —
// não dá pra prever/allowlistar domínio (isso já mordeu a gente uma vez com
// o favicon do Google redirecionando pra gstatic.com). <img> não executa
// nada, então abrir img-src pra https: não reintroduz risco de XSS.
function buildCspHeader(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https: data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

// Só CSP aqui: é a única que precisa ser dinâmica (nonce por request). HSTS,
// Permissions-Policy e os outros headers estáticos ficam em next.config.ts,
// que também cobre rotas que o matcher deste middleware pula (_next/static
// etc.) — setar os dois em lugares diferentes evitaria um header duplicado
// na mesma resposta.
function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
  return response;
}

export async function updateSession(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");

  // O nonce também vai num header de request, pra layout.tsx poder ler via
  // headers() se algum dia precisar de um <script> inline nosso.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  // Com Fluid compute, não guarde este client em variável global —
  // sempre crie um novo a cada request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Não rode nada entre createServerClient e getClaims() — um erro aqui
  // pode deslogar usuários aleatoriamente.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applySecurityHeaders(NextResponse.redirect(url), nonce);
  }

  // Reforça o desafio de MFA em toda rota protegida, não só no momento do
  // login — sem isso, alguém com a senha e o cookie de sessão (mas sem o
  // segundo fator) podia simplesmente navegar direto pra uma URL protegida
  // e pular a etapa. "/login/mfa" já cai em isPublicPath (prefixo "/login"),
  // então não entra nesse bloco — sem risco de loop de redirect.
  if (user && !isPublicPath) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/login/mfa";
      url.search = "";
      url.searchParams.set("next", request.nextUrl.pathname);
      return applySecurityHeaders(NextResponse.redirect(url), nonce);
    }
  }

  return applySecurityHeaders(supabaseResponse, nonce);
}
