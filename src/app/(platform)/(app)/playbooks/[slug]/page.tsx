import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { getPlaybook } from "@/lib/playbooks";
import { Clock, ArrowLeft } from "lucide-react";

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const { slug } = await params;
  const playbook = getPlaybook(slug);
  if (!playbook) notFound();

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[680px]">
      <Link href="/playbooks" className="text-[12.5px] mb-4.5 inline-flex items-center gap-1 no-underline" style={{ color: "var(--fg-muted)" }}>
        <ArrowLeft size={13} strokeWidth={2} />
        Playbooks
      </Link>

      <div
        className="text-[10.5px] font-semibold uppercase self-start rounded-full px-2.5 py-1 inline-block mb-3"
        style={{ background: "var(--primary-soft)", color: "var(--primary)", letterSpacing: "0.05em" }}
      >
        {playbook.category}
      </div>

      <h1
        className="text-[26px] font-medium m-0 mb-2"
        style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
      >
        {playbook.title}
      </h1>

      <div className="flex items-center gap-1 text-[12px] mb-7" style={{ color: "var(--fg-faint)" }}>
        <Clock size={12} strokeWidth={1.75} />
        {playbook.readMinutes} min de leitura
      </div>

      <div className="flex flex-col gap-4">
        {playbook.body.map((paragraph, i) => (
          <p key={i} className="text-[14.5px] leading-[1.7] m-0" style={{ color: "var(--fg)" }}>
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
