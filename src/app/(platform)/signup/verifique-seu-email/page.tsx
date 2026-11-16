export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[420px] px-6 text-center">
        <h1
          className="text-[22px] font-medium m-0 mb-3"
          style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
        >
          Confirme seu e-mail
        </h1>
        <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--fg-muted)" }}>
          Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e continuar o
          cadastro.
        </p>
      </div>
    </div>
  );
}
