import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { PLAYBOOKS } from "@/lib/playbooks";
import { Clock, ArrowRight } from "lucide-react";

export default async function PlaybooksPage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  return (
    <div>
      <div className="pt-6 px-4 md:px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Playbooks
        </h1>
        <p className="m-0 text-[13.5px] max-w-[60ch]" style={{ color: "var(--fg-muted)" }}>
          Guias curtos e diretos pra vender melhor — abordagem, descoberta, objeções e fechamento.
        </p>
      </div>

      <div
        className="px-4 md:px-10 pt-6 pb-16 grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {PLAYBOOKS.map((p) => (
          <Link
            key={p.slug}
            href={`/playbooks/${p.slug}`}
            className="flex flex-col gap-2.5 rounded-[16px] border p-5 no-underline"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="text-[10.5px] font-semibold uppercase self-start rounded-full px-2.5 py-1"
              style={{ background: "var(--primary-soft)", color: "var(--primary)", letterSpacing: "0.05em" }}
            >
              {p.category}
            </div>
            <div className="text-[15px] font-semibold leading-[1.35]">{p.title}</div>
            <p className="text-[12.5px] leading-[1.55] m-0 flex-1" style={{ color: "var(--fg-muted)" }}>
              {p.summary}
            </p>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
                <Clock size={12} strokeWidth={1.75} />
                {p.readMinutes} min de leitura
              </div>
              <ArrowRight size={14} strokeWidth={1.75} style={{ color: "var(--fg-faint)" }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
