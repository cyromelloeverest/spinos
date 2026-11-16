import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { platformHosts } from "@/lib/sites/env";

// www.app.spinos.com.br existe só como alias de DNS — sem esse redirect ele
// serviria o mesmo app num host diferente, e cookie de sessão/URL de auth do
// Supabase são amarrados a um host só (app.spinos.com.br), o que quebraria
// login pra quem entrasse por aqui.
const WWW_HOST = "www.app.spinos.com.br";
const CANONICAL_HOST = "app.spinos.com.br";

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();
  if (host === WWW_HOST) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Sites públicos dos clientes: qualquer domínio que NÃO seja da plataforma. Vai direto
  // para o renderizador (sem login, sem a CSP do app), com o domínio como segmento da rota.
  // Domínio desconhecido cai no 404 do site: nunca mostra nada da plataforma.
  const hostname = host?.split(":")[0];
  // O renderizador de sites só se alcança pelo domínio do próprio site. No domínio da plataforma o
  // caminho interno /sites/... não existe: senão qualquer site publicado abriria dentro da origem do
  // app (mesmos cookies de sessão), e um erro no conteúdo de um cliente viraria erro no app.
  if (hostname && isPlatformHost(hostname) && (request.nextUrl.pathname === "/sites" || request.nextUrl.pathname.startsWith("/sites/"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (hostname && !isPlatformHost(hostname)) {
    // Um domínio só tem letras, números, pontos e hífens: qualquer outra coisa não vira caminho interno.
    if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(hostname)) return new NextResponse("Not found", { status: 404 });
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${hostname}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  // O ícone da plataforma só vale nos domínios dela; o do site vem do renderizador.
  if (request.nextUrl.pathname === "/favicon.ico") return NextResponse.next();

  return await updateSession(request);
}

function isPlatformHost(hostname: string): boolean {
  return platformHosts().includes(hostname) || hostname.endsWith(".vercel.app");
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
