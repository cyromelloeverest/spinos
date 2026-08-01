import Link from "next/link";

export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="pt-10 px-10 max-w-[560px]">
      <h1 className="text-[22px] font-medium m-0 mb-3" style={{ fontFamily: "var(--font-display)" }}>
        Link inválido ou expirado
      </h1>
      <p className="text-[13.5px] leading-[1.6] mb-3" style={{ color: "var(--fg-muted)" }}>
        O link de confirmação não é mais válido. Tente entrar novamente ou peça um novo link.
      </p>
      {params.reason && (
        <p
          className="text-[12px] font-mono rounded-[8px] border px-3 py-2 mb-4"
          style={{ borderColor: "var(--border)", color: "var(--fg-faint)" }}
        >
          {params.reason}
        </p>
      )}
      <Link href="/login" className="text-[13px] no-underline" style={{ color: "var(--copper)" }}>
        Voltar para o login →
      </Link>
    </div>
  );
}
