"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Target, Radar, Kanban, Bot, History, BookOpen, Building2, Users, Plug, LogOut, X, ShieldCheck, ScanSearch, ChevronsUpDown, Check } from "lucide-react";
import { switchOrganization } from "@/lib/actions/organization";
import { initials } from "@/lib/initials";

export type OrgProfile = {
  name: string;
  segment: string | null;
  city: string | null;
  state: string | null;
} | null;

export type OrgMembership = { organizationId: string; name: string };

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/oportunidades", label: "Oportunidades", icon: Target },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/assistente-vendas", label: "Assistente de Vendas", icon: Bot },
  { href: "/inteligencia-competitiva", label: "Inteligência Competitiva", icon: ScanSearch, comingSoon: true },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/playbooks", label: "Playbooks", icon: BookOpen },
];

const configItems = [
  { href: "/settings/empresa", label: "Perfil da empresa", icon: Building2, enabled: true },
  { href: "/settings/icp", label: "Meu ICP", icon: Target, enabled: true },
  { href: "/settings/equipe", label: "Equipe", icon: Users, enabled: true },
  { href: "#", label: "Integrações", icon: Plug, enabled: false },
];

const roadmapItems = [
  "Chat com IA sobre suas oportunidades",
  "Exportar direto para CRM (HubSpot/Pipedrive)",
  "Alertas automáticos de novas oportunidades",
];

export function Rail({
  organization,
  signOutAction,
  isSuperAdmin = false,
  open = false,
  onNavigate,
  memberships = [],
  currentOrganizationId = null,
}: {
  organization: OrgProfile;
  signOutAction: () => Promise<void>;
  isSuperAdmin?: boolean;
  open?: boolean;
  onNavigate?: () => void;
  memberships?: OrgMembership[];
  currentOrganizationId?: string | null;
}) {
  const pathname = usePathname();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const canSwitchOrg = memberships.length > 1;

  const displayName = organization?.name ?? "Configurar empresa";
  const locationLine = [organization?.city, organization?.state].filter(Boolean).join(", ");

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-[240px] flex flex-col gap-6 p-4 overflow-y-auto border-r transform transition-transform duration-200 md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      style={{ background: "var(--dark)", color: "var(--dark-fg)", borderColor: "var(--dark-border)" }}
    >
      <div className="flex items-center justify-between px-1.5">
        <Link href="/" onClick={onNavigate} className="flex items-center no-underline" style={{ color: "var(--dark-fg)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-branco.svg" alt="Spinos" height={30} style={{ height: "30px", width: "auto" }} />
        </Link>
        <button
          type="button"
          onClick={onNavigate}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-[8px]"
          style={{ color: "var(--dark-fg-muted)", background: "transparent", border: "none" }}
          aria-label="Fechar menu"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-2.5 px-2.5 py-[8px] rounded-[8px] text-[13.5px] no-underline"
              style={{
                color: active ? "#ffffff" : "var(--dark-fg-muted)",
                background: active ? "var(--primary)" : "transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
              {"comingSoon" in item && item.comingSoon && (
                <span
                  className="text-[9px] font-semibold uppercase rounded-full px-1.5 py-[1px] flex-shrink-0 ml-auto"
                  style={{ background: "var(--dark-hover)", color: "var(--dark-fg-muted)", letterSpacing: "0.04em" }}
                >
                  Em breve
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div>
        <div
          className="text-[10.5px] uppercase px-2.5 mb-1.5 font-medium"
          style={{ color: "var(--dark-fg-muted)", letterSpacing: "0.06em" }}
        >
          Em breve
        </div>
        <div className="flex flex-col gap-0.5">
          {roadmapItems.map((label) => (
            <div
              key={label}
              className="flex items-start gap-2.5 px-2.5 py-[7px] rounded-[8px] text-[12.5px] leading-[1.4]"
              style={{ color: "var(--dark-fg-muted)", opacity: 0.65 }}
            >
              <span
                className="w-[5px] h-[5px] rounded-full flex-shrink-0 mt-[6px]"
                style={{ border: "1px solid var(--dark-fg-muted)" }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div
          className="text-[10.5px] uppercase px-2.5 mb-1.5 font-medium"
          style={{ color: "var(--dark-fg-muted)", letterSpacing: "0.06em" }}
        >
          Configuração
        </div>
        <nav className="flex flex-col gap-0.5">
          {configItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            if (!item.enabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] text-[13.5px]"
                  style={{ color: "var(--dark-fg-muted)", opacity: 0.5, cursor: "default" }}
                >
                  <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" />
                  {item.label}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] text-[13.5px] no-underline"
                style={{
                  color: active ? "#ffffff" : "var(--dark-fg-muted)",
                  background: active ? "var(--dark-hover)" : "transparent",
                }}
              >
                <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {isSuperAdmin && (
        <div>
          <div
            className="text-[10.5px] uppercase px-2.5 mb-1.5 font-medium"
            style={{ color: "var(--dark-fg-muted)", letterSpacing: "0.06em" }}
          >
            Admin
          </div>
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] text-[13.5px] no-underline"
            style={{
              color: pathname === "/admin" ? "#ffffff" : "var(--dark-fg-muted)",
              background: pathname === "/admin" ? "var(--dark-hover)" : "transparent",
            }}
          >
            <ShieldCheck size={16} strokeWidth={1.75} className="flex-shrink-0" />
            Painel administrador
          </Link>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <div className="relative">
          {orgMenuOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setOrgMenuOpen(false)} />
          )}

          {canSwitchOrg && orgMenuOpen && (
            <div
              className="absolute bottom-full left-0 right-0 mb-1.5 z-50 rounded-[10px] border overflow-hidden py-1"
              style={{ background: "var(--dark-hover)", borderColor: "var(--dark-border)" }}
            >
              {memberships.map((m) => (
                <form key={m.organizationId} action={switchOrganization.bind(null, m.organizationId)}>
                  <button
                    type="submit"
                    disabled={m.organizationId === currentOrganizationId}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] border-0"
                    style={{
                      background: "transparent",
                      color: m.organizationId === currentOrganizationId ? "#ffffff" : "var(--dark-fg-muted)",
                      cursor: m.organizationId === currentOrganizationId ? "default" : "pointer",
                    }}
                  >
                    <span className="truncate flex-1">{m.name}</span>
                    {m.organizationId === currentOrganizationId && (
                      <Check size={14} strokeWidth={2} className="flex-shrink-0" style={{ color: "var(--primary)" }} />
                    )}
                  </button>
                </form>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => canSwitchOrg && setOrgMenuOpen((v) => !v)}
            className="w-full rounded-[10px] p-3 flex items-start gap-2.5 border-0 text-left relative z-30"
            style={{
              background: "var(--dark-hover)",
              cursor: canSwitchOrg ? "pointer" : "default",
            }}
          >
            <div
              className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center text-[10.5px] flex-shrink-0 font-semibold"
              style={{
                background: "var(--primary)",
                color: "#ffffff",
              }}
            >
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold" style={{ color: "#ffffff" }}>
                {displayName}
              </div>
              {organization?.segment && (
                <div className="text-[11px] mt-0.5 leading-[1.3]" style={{ color: "var(--dark-fg-muted)" }}>
                  {organization.segment}
                </div>
              )}
              {locationLine && (
                <div className="text-[10.5px] mt-0.5" style={{ color: "var(--dark-fg-muted)" }}>
                  {locationLine}
                </div>
              )}
            </div>
            {canSwitchOrg && (
              <ChevronsUpDown size={14} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" style={{ color: "var(--dark-fg-muted)" }} />
            )}
          </button>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 text-[12px] cursor-pointer w-full px-2.5"
            style={{ background: "none", border: "none", color: "var(--dark-fg-muted)", padding: "6px 10px" }}
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
