import Link from "next/link";

export default function ConviteInvalidoPage() {
  return (
    <div className="pt-10 px-10 max-w-[560px]">
      <h1 className="text-[22px] font-medium m-0 mb-3" style={{ fontFamily: "var(--font-display)" }}>
        Convite inválido ou expirado
      </h1>
      <p className="text-[13.5px] leading-[1.6] mb-3" style={{ color: "var(--fg-muted)" }}>
        Esse link de convite não é mais válido. Peça para quem te convidou enviar um novo.
      </p>
      <Link href="/login" className="text-[13px] no-underline" style={{ color: "var(--primary)" }}>
        Voltar para o login →
      </Link>
    </div>
  );
}
