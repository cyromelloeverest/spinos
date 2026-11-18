"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Settings, ChevronDown, Check, LogOut, Building2 } from "lucide-react";
import { switchOrganization } from "@/lib/actions/organization";
import { initials } from "@/lib/initials";
import type { OrgMembership } from "./Rail";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MEMBER: "Membro",
  AGENCY: "Agência",
};

export function TopBar({
  organizationName,
  memberships = [],
  currentOrganizationId = null,
  signOutAction,
  onMenuClick,
}: {
  organizationName: string;
  memberships?: OrgMembership[];
  currentOrganizationId?: string | null;
  signOutAction: () => Promise<void>;
  onMenuClick?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const canSwitchOrg = memberships.length > 1;
  const current = memberships.find((m) => m.organizationId === currentOrganizationId);
  const roleLabel = current ? (ROLE_LABEL[current.role] ?? "") : "";

  return (
    <header className="relative z-30 flex items-center justify-between h-16 px-4 md:px-6 flex-shrink-0" style={{ color: "var(--dark-fg)" }}>
      <div className="flex items-center gap-3 md:hidden">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex items-center justify-center w-9 h-9 rounded-[10px]"
          style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#ffffff" }}
          aria-label="Abrir menu"
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>
        <Link href="/" className="flex items-center no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-branco.svg" alt="Spinos" style={{ height: "36px", width: "auto" }} />
        </Link>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <Link
          href="/settings/empresa"
          aria-label="Configurações da empresa"
          className="flex items-center justify-center w-9 h-9 rounded-[10px] no-underline"
          style={{ color: "var(--dark-fg-muted)" }}
        >
          <Settings size={18} strokeWidth={1.75} />
        </Link>

        <div className="relative ml-2 pl-3 md:border-l" style={{ borderColor: "var(--dark-border)" }}>
          {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="relative z-50 flex items-center gap-2.5 rounded-[12px] pl-1 pr-2 py-1 text-left"
            style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer" }}
          >
            <span
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
              style={{ background: "var(--primary)", color: "#ffffff" }}
            >
              {initials(organizationName)}
            </span>
            <span className="hidden sm:block min-w-0">
              <span className="block text-[13px] font-semibold leading-tight truncate max-w-[200px]">{organizationName}</span>
              {roleLabel && (
                <span className="block text-[11.5px] leading-tight mt-0.5" style={{ color: "var(--dark-fg-muted)" }}>
                  {roleLabel}
                </span>
              )}
            </span>
            <ChevronDown size={15} strokeWidth={1.75} style={{ color: "var(--dark-fg-muted)" }} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 z-50 w-[280px] rounded-[14px] border overflow-hidden py-1.5"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--fg)", boxShadow: "0 12px 32px rgba(15,23,42,0.18)" }}
            >
              {canSwitchOrg && (
                <div className="pb-1.5 mb-1.5 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="text-[10.5px] uppercase font-medium px-4 pt-1.5 pb-1" style={{ color: "var(--fg-muted)", letterSpacing: "0.06em" }}>
                    Trocar de conta
                  </div>
                  {memberships.map((m) => {
                    const isCurrent = m.organizationId === currentOrganizationId;
                    return (
                      <form key={m.organizationId} action={switchOrganization.bind(null, m.organizationId)}>
                        <button
                          type="submit"
                          disabled={isCurrent}
                          role="menuitem"
                          className="flex items-center gap-2 w-full text-left px-4 py-2 text-[13px] border-0"
                          style={{ background: "transparent", color: "var(--fg)", cursor: isCurrent ? "default" : "pointer", fontWeight: isCurrent ? 600 : 400 }}
                        >
                          <span className="truncate flex-1">{m.name}</span>
                          {m.role === "AGENCY" && (
                            <span
                              className="text-[9px] font-semibold uppercase rounded-full px-1.5 py-[1px] flex-shrink-0"
                              style={{ background: "var(--card-hover)", color: "var(--fg-muted)", letterSpacing: "0.04em" }}
                            >
                              Agência
                            </span>
                          )}
                          {isCurrent && <Check size={14} strokeWidth={2} className="flex-shrink-0" style={{ color: "var(--primary)" }} />}
                        </button>
                      </form>
                    );
                  })}
                </div>
              )}
              <Link
                href="/settings/empresa"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-[13px] no-underline"
                style={{ color: "var(--fg)" }}
              >
                <Building2 size={15} strokeWidth={1.75} style={{ color: "var(--fg-muted)" }} />
                Perfil da empresa
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-[13px] border-0 cursor-pointer"
                  style={{ background: "transparent", color: "var(--fg)" }}
                >
                  <LogOut size={15} strokeWidth={1.75} style={{ color: "var(--fg-muted)" }} />
                  Sair
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
