export function DbSetupNotice() {
  return (
    <div className="pt-10 px-10 max-w-[620px]">
      <h1 className="text-[22px] font-medium m-0 mb-3" style={{ fontFamily: "var(--font-display)" }}>
        Banco de dados ainda não configurado
      </h1>
      <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--fg-muted)" }}>
        Esta ação precisa de um Postgres real. Crie um projeto no{" "}
        <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
          Supabase
        </a>{" "}
        e cole a Connection String no arquivo <code>.env</code> na chave <code>DATABASE_URL</code>. Depois rode:
      </p>
      <pre
        className="mt-3 rounded-[8px] border p-3 text-[12px] overflow-x-auto"
        style={{ background: "var(--card)", borderColor: "var(--border)", fontFamily: "var(--font-mono)" }}
      >
        npx prisma migrate dev --name init{"\n"}npx prisma db seed
      </pre>
    </div>
  );
}
