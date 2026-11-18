// Cabeçalho padrão das telas: título e descrição à esquerda, ação principal opcional à direita.
// `inset` é para telas em que o cabeçalho fica fora do contêiner com margens laterais.
export function PageHeader({
  title,
  children,
  meta,
  action,
  inset = false,
}: {
  title: string;
  children?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  inset?: boolean;
}) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${inset ? "px-4 md:px-10 pt-6" : "mb-6"}`}>
      <div className="min-w-0 max-w-[72ch]">
        <h1 className="m-0 text-[26px] font-semibold leading-tight" style={{ color: "var(--fg)", letterSpacing: "-0.01em" }}>
          {title}
        </h1>
        {children && (
          <p className="m-0 mt-1.5 text-[13.5px] leading-[1.55]" style={{ color: "var(--fg-muted)" }}>
            {children}
          </p>
        )}
        {meta && (
          <p className="m-0 mt-1 text-[12.5px] leading-[1.5]" style={{ color: "var(--fg-muted)" }}>
            {meta}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
