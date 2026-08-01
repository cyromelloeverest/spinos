import Link from "next/link";

export function TopBar({ organizationName }: { organizationName: string }) {
  const initials = organizationName
    .split(" ")
    .filter((w) => w.length > 1)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex items-center justify-end px-6 py-2.5 border-b flex-shrink-0"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <Link
        href="/settings/empresa"
        className="flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 border no-underline"
        style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--fg)" }}
      >
        <span
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
          style={{ background: "var(--card-hover)", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}
        >
          {initials}
        </span>
        <span className="text-[12.5px] font-medium">{organizationName}</span>
      </Link>
    </div>
  );
}
