"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

export function TopBar({ organizationName, onMenuClick }: { organizationName: string; onMenuClick?: () => void }) {
  const initials = organizationName
    .split(" ")
    .filter((w) => w.length > 1)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex items-center justify-between md:justify-end px-4 md:px-6 py-2.5 border-b flex-shrink-0"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-[8px] border"
        style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--fg)" }}
        aria-label="Abrir menu"
      >
        <Menu size={18} strokeWidth={1.75} />
      </button>
      <Link href="/" className="md:hidden flex items-center no-underline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-preto.svg" alt="Spinos" style={{ height: "18px", width: "auto" }} />
      </Link>
      <Link
        href="/settings/empresa"
        className="flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 border no-underline"
        style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--fg)" }}
      >
        <span
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
          style={{ background: "var(--card-hover)", color: "var(--fg-muted)" }}
        >
          {initials}
        </span>
        <span className="text-[12.5px] font-medium hidden sm:inline">{organizationName}</span>
      </Link>
    </div>
  );
}
