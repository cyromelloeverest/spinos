import { withOrgContext } from "@/lib/db/with-org-context";
import { suppressEmail } from "@/lib/email/audience";
import { verifyUnsubscribe } from "@/lib/email/tokens";
import { logError } from "@/lib/log-error";

// Descadastro de um clique (RFC 8058): Gmail e Yahoo fazem um POST neste endereço quando a pessoa
// usa o botão "cancelar inscrição" do próprio e-mail. O link carrega a assinatura, sem login.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const email = verifyUnsubscribe(url.searchParams.get("o"), url.searchParams.get("e"), url.searchParams.get("t"));
  if (!email) return new Response("Link inválido", { status: 400 });
  const organizationId = url.searchParams.get("o")!;
  try {
    await withOrgContext(organizationId, (tx) => suppressEmail(tx, organizationId, email, "UNSUBSCRIBE"));
  } catch (err) {
    logError("email/unsubscribe: falha", err, { organizationId });
    return new Response("Erro", { status: 500 });
  }
  return new Response("OK");
}
