import { redirect } from "next/navigation";
import { confirmAuthLink } from "@/lib/actions/auth";

const TITLE_BY_TYPE: Record<string, string> = {
  recovery: "Confirmar redefinição de senha",
  signup: "Confirmar seu e-mail",
  email_change: "Confirmar troca de e-mail",
  invite: "Confirmar acesso",
  magiclink: "Confirmar acesso",
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; next?: string; error_description?: string }>;
}) {
  const params = await searchParams;

  if (params.error_description) {
    redirect(`/auth/auth-code-error?reason=${encodeURIComponent(params.error_description)}`);
  }
  if (!params.code && !params.token_hash) {
    redirect("/auth/auth-code-error?reason=Link sem código de confirmação.");
  }

  const title = (params.type && TITLE_BY_TYPE[params.type]) || "Confirmar";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[380px] px-6 text-center">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-preto.svg" alt="Spinos" style={{ height: "36px", width: "auto" }} />
        </div>

        <h1 className="text-[22px] font-medium m-0 mb-3" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
        <p className="text-[13.5px] leading-[1.6] mb-6" style={{ color: "var(--fg-muted)" }}>
          Por segurança, confirme clicando no botão abaixo (isso evita que o link seja consumido automaticamente por antivírus de e-mail antes de você usá-lo).
        </p>

        <form action={confirmAuthLink}>
          <input type="hidden" name="code" value={params.code ?? ""} />
          <input type="hidden" name="token_hash" value={params.token_hash ?? ""} />
          <input type="hidden" name="type" value={params.type ?? ""} />
          <input type="hidden" name="next" value={params.next ?? "/"} />
          <button
            type="submit"
            className="w-full text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
          >
            Confirmar agora
          </button>
        </form>
      </div>
    </div>
  );
}
