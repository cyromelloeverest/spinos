import { unsubscribeAction } from "./actions";
import { verifyUnsubscribe } from "@/lib/email/tokens";

// Página pública (sem login): quem recebeu a campanha confirma que não quer mais receber. O clique no
// link do e-mail só MOSTRA esta página; quem descadastra é o botão. Assim, antivírus e leitores de
// e-mail que abrem links automaticamente não descadastram ninguém por engano.
export default async function DescadastrarPage({ searchParams }: { searchParams: Promise<{ o?: string; e?: string; t?: string; feito?: string }> }) {
  const p = await searchParams;
  const email = verifyUnsubscribe(p.o ?? null, p.e ?? null, p.t ?? null);
  const box = { maxWidth: 460, margin: "80px auto", padding: "0 20px", textAlign: "center" as const, color: "var(--fg)" };
  if (!email) {
    return (
      <div style={box}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Link inválido</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>Este link de descadastro não é válido. Use o link do e-mail mais recente ou responda ao e-mail pedindo para sair.</p>
      </div>
    );
  }
  if (p.feito) {
    return (
      <div style={box}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Pronto, você não vai mais receber</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>O endereço {maskEmail(email)} foi removido da lista. Se foi engano, peça a quem escreveu para incluir você de novo.</p>
      </div>
    );
  }
  return (
    <div style={box}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Não quero mais receber</h1>
      <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>Confirme para parar de receber e-mails de campanha em {maskEmail(email)}.</p>
      <form action={unsubscribeAction}>
        <input type="hidden" name="o" value={p.o} />
        <input type="hidden" name="e" value={p.e} />
        <input type="hidden" name="t" value={p.t} />
        <button type="submit" style={{ background: "var(--primary)", color: "#ffffff", border: 0, borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Confirmar descadastro</button>
      </form>
    </div>
  );
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}
