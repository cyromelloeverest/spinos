import Link from "next/link";
import { initials } from "@/lib/initials";

const CARD_CLASS = "block rounded-[16px] no-underline";
const CARD_STYLE: React.CSSProperties = {
  background: "var(--card)",
  color: "var(--fg)",
  boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 2px 6px -2px rgba(16,24,40,.06), inset 0 0 0 1px rgba(8,20,38,0.06)",
};

// Pílula de status no padrão das listas (cores suaves, texto legível).
export function Pill({ tone, children }: { tone: "primary" | "good" | "warn" | "critical" | "muted"; children: React.ReactNode }) {
  const map = {
    primary: ["var(--primary-soft)", "var(--primary)"],
    good: ["var(--good-soft)", "var(--good)"],
    warn: ["var(--warn-soft)", "#B45309"],
    critical: ["var(--critical-soft)", "#B91C1C"],
    muted: ["var(--card-hover)", "var(--fg-muted)"],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <span className="inline-flex items-center text-[11.5px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

// Cartão de lista no padrão do CRM: avatar com iniciais (ou um elemento próprio), título, subtítulo e
// um espaço à direita. Com `href` o cartão inteiro é um link e sobe um pouco ao passar o mouse;
// sem `href` aceita `children` (conteúdo extra abaixo da linha principal).
export function ListCard({
  href,
  avatar,
  leading,
  tone = "#175CFF",
  title,
  subtitle,
  right,
  children,
}: {
  href?: string;
  avatar?: string;
  leading?: React.ReactNode;
  tone?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const row = (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      {leading ?? (
        <span
          aria-hidden
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[12.5px] font-bold"
          style={{ background: `${tone}22`, color: "#0C2F8A", boxShadow: `inset 0 0 0 1px ${tone}40` }}
        >
          {initials(avatar ?? "")}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold leading-snug truncate">{title}</div>
        {subtitle && (
          <div className="text-[12.5px] mt-0.5 truncate" style={{ color: "var(--fg-muted)" }}>
            {subtitle}
          </div>
        )}
      </div>
      {right && <div className="flex-shrink-0 flex items-center gap-3 text-[12.5px]">{right}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={`${CARD_CLASS} transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_rgba(23,92,255,.30)]`} style={CARD_STYLE}>
        {row}
      </Link>
    );
  }
  return (
    <div className={CARD_CLASS} style={CARD_STYLE}>
      {row}
      {children && <div className="px-4 pb-3.5 -mt-1">{children}</div>}
    </div>
  );
}
