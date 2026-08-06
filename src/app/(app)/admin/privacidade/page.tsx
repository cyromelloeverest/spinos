import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isCurrentUserSuperAdmin } from "@/lib/auth/current-org";
import { RedactThirdPartyButton } from "@/components/RedactThirdPartyButton";
import { ArrowLeft, Search, ShieldAlert } from "lucide-react";

// Busca uma pessoa física (decisor encontrado pela IA ou cadastrado
// manualmente) em qualquer organização, pra atender um pedido de remoção
// feito diretamente por ela — não pelo dono da conta (ver
// requestAccountDeletion, que é o fluxo pro próprio cliente). Só entra em
// ação se o termo tiver tamanho mínimo, pra não devolver a base inteira.
async function searchThirdPartyData(query: string) {
  if (query.trim().length < 3) return [];

  return prisma.opportunityScore.findMany({
    where: {
      OR: [
        { decisionMakerName: { contains: query, mode: "insensitive" } },
        { contactName: { contains: query, mode: "insensitive" } },
        { contactEmail: { contains: query, mode: "insensitive" } },
        { contactPhone: { contains: query } },
      ],
    },
    include: {
      organization: { select: { name: true } },
      company: { select: { name: true } },
    },
    take: 50,
  });
}

export default async function AdminPrivacidadePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) redirect("/");

  const params = await searchParams;
  const query = params.q ?? "";
  const results = await searchThirdPartyData(query);

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[900px]">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12.5px] mb-4" style={{ color: "var(--fg-muted)" }}>
        <ArrowLeft size={14} strokeWidth={1.75} />
        Painel administrador
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert size={20} strokeWidth={1.75} style={{ color: "var(--primary)" }} />
        <h1 className="text-[25px] font-medium m-0" style={{ fontFamily: "var(--font-display)" }}>
          Dados de terceiros (LGPD)
        </h1>
      </div>
      <p className="m-0 mb-6 text-[13.5px] max-w-[560px]" style={{ color: "var(--fg-muted)" }}>
        Busque uma pessoa por nome, e-mail ou telefone em todas as organizações clientes para atender um pedido de
        remoção feito por ela mesma (art. 18, LGPD). Apaga só os dados que a identificam — o sinal comercial em si
        (score, empresa, urgência) continua.
      </p>

      <form className="flex gap-2 mb-8 max-w-[480px]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Nome, e-mail ou telefone"
          className="flex-1 rounded-[10px] border px-3.5 h-[42px] text-[13.5px] outline-none"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 text-[13px] font-semibold px-4 rounded-[10px] border-0 cursor-pointer"
          style={{ background: "var(--primary)", color: "#ffffff" }}
        >
          <Search size={14} strokeWidth={2} />
          Buscar
        </button>
      </form>

      {query.trim().length > 0 && query.trim().length < 3 && (
        <p className="text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
          Digite ao menos 3 caracteres.
        </p>
      )}

      {query.trim().length >= 3 && results.length === 0 && (
        <p className="text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
          Nenhum resultado para &quot;{query}&quot;.
        </p>
      )}

      {results.length > 0 && (
        <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {results.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-[13px] flex-wrap"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div>
                <div className="font-semibold">{r.decisionMakerName || r.contactName || "—"}</div>
                <div className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
                  {[r.contactEmail, r.contactPhone].filter(Boolean).join(" · ") || "sem e-mail/telefone"}
                </div>
                <div className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-faint)" }}>
                  Cliente: {r.organization.name} · Empresa monitorada: {r.company.name}
                </div>
              </div>
              <RedactThirdPartyButton opportunityScoreId={r.id} personName={r.decisionMakerName || r.contactName || "esta pessoa"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
