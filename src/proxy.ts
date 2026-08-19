import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

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

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
