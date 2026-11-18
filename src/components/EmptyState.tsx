import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Estado vazio: ícone, mensagem e, quando faz sentido, o próximo passo.
export function EmptyState({
  message,
  icon: Icon,
  action,
}: {
  message: string;
  icon?: LucideIcon;
  action?: { label: string; href: string };
}) {
  return (
    <div
      className="rounded-[16px] border flex flex-col items-center text-center px-6 py-10"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      {Icon && (
        <span
          className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
      )}
      <p className="m-0 text-[13.5px] leading-[1.55] max-w-[46ch]" style={{ color: "var(--fg-muted)" }}>
        {message}
      </p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 no-underline text-[13px] font-semibold px-4 py-2.5 rounded-[12px]"
          style={{ background: "var(--primary)", color: "#ffffff" }}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
