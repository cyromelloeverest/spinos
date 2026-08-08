import Link from "next/link";

export function LegalPageLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[760px] mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-preto.svg" alt="Spinos" style={{ height: "32px", width: "auto" }} />
          </Link>
          <Link href="/login" className="text-[12.5px] font-medium" style={{ color: "var(--primary)" }}>
            Entrar
          </Link>
        </div>
      </header>

      <main className="max-w-[760px] mx-auto px-6 py-12">
        <h1
          className="text-[26px] font-medium m-0 mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
        >
          {title}
        </h1>
        <p className="text-[12.5px] mb-10" style={{ color: "var(--fg-faint)" }}>
          Última atualização: {updatedAt}
        </p>

        <div
          className="flex flex-col gap-8 text-[13.5px] leading-relaxed [&_h2]:text-[16px] [&_h2]:font-medium [&_h2]:mb-3 [&_h2]:mt-0 [&_p]:m-0 [&_p]:mb-3 [&_ul]:m-0 [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_li]:m-0 [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:font-medium [&_th]:pb-2 [&_th]:border-b [&_td]:py-2 [&_td]:border-b [&_strong]:font-semibold"
          style={{ color: "var(--fg-muted)" }}
        >
          {children}
        </div>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div
          className="max-w-[760px] mx-auto px-6 py-6 flex items-center gap-4 text-[12px]"
          style={{ color: "var(--fg-faint)" }}
        >
          <Link href="/termos" style={{ color: "var(--fg-faint)" }}>
            Termos de Uso
          </Link>
          <Link href="/privacidade" style={{ color: "var(--fg-faint)" }}>
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
