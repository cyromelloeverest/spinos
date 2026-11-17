"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Radar, Kanban, Bot, History, BookOpen, Building2, Users, Plug, X, ShieldCheck, ScanSearch, ListChecks, Inbox, Contact, Zap, Globe, BarChart3, PenLine, Mail } from "lucide-react";

export type OrgProfile = {
  name: string;
  segment: string | null;
  city: string | null;
  state: string | null;
} | null;

export type OrgMembership = { organizationId: string; name: string; role: string };

type NavItem = { href: string; label: string; icon: typeof Target; comingSoon?: boolean; disabled?: boolean };
type NavGroup = { label: string | null; items: NavItem[]; adminOnly?: boolean };

// Ordem pensada no fluxo de trabalho: encontrar clientes → atendê-los → divulgar → medir → configurar.
const groups: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Prospecção",
    items: [
      { href: "/oportunidades", label: "Oportunidades", icon: Target },
      { href: "/radar", label: "Radar", icon: Radar },
      { href: "/assistente-vendas", label: "Assistente de Vendas", icon: Bot },
      { href: "/playbooks", label: "Playbooks", icon: BookOpen },
      { href: "/historico", label: "Histórico", icon: History },
      { href: "/inteligencia-competitiva", label: "Concorrentes", icon: ScanSearch, comingSoon: true },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/pipeline", label: "CRM", icon: Kanban },
      { href: "/leads", label: "Leads", icon: Inbox },
      { href: "/contatos", label: "Contatos", icon: Contact },
      { href: "/atividades", label: "Atividades", icon: ListChecks },
      { href: "/automacoes", label: "Automações", icon: Zap },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/meu-site", label: "Meu site", icon: Globe },
      { href: "/conteudo", label: "Conteúdo", icon: PenLine },
      { href: "/emails", label: "E-mails", icon: Mail },
    ],
  },
  {
    label: "Acompanhamento",
    items: [{ href: "/relatorios", label: "Relatórios", icon: BarChart3 }],
  },
  {
    label: "Gestão",
    items: [
      { href: "/settings/empresa", label: "Perfil da empresa", icon: Building2 },
      { href: "/settings/icp", label: "Meu ICP", icon: Target },
      { href: "/settings/equipe", label: "Equipe", icon: Users },
      { href: "#", label: "Integrações", icon: Plug, disabled: true },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [{ href: "/admin", label: "Painel administrador", icon: ShieldCheck }],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Rail({
  isSuperAdmin = false,
  open = false,
  onNavigate,
}: {
  isSuperAdmin?: boolean;
  open?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-[248px] flex flex-col overflow-y-auto transform transition-transform duration-200 bg-[var(--dark)] md:bg-transparent md:static md:translate-x-0 md:h-dvh ${open ? "translate-x-0" : "-translate-x-full"}`}
      style={{ color: "var(--dark-fg)" }}
    >
      <div className="flex items-center justify-between h-16 px-5 flex-shrink-0">
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

      <nav className="flex flex-col gap-5 px-3 pt-3 pb-8">
        {groups
          .filter((g) => !g.adminOnly || isSuperAdmin)
          .map((group, gi) => (
            <div key={group.label ?? `g${gi}`}>
              {group.label && (
                <div
                  className="text-[10.5px] uppercase px-3 mb-1.5 font-medium"
                  style={{ color: "var(--dark-fg-muted)", letterSpacing: "0.08em" }}
                >
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  if (item.disabled) {
                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[13.5px]"
                        style={{ color: "var(--dark-fg-muted)", opacity: 0.5, cursor: "default" }}
                      >
                        <Icon size={17} strokeWidth={1.75} className="flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                        <span
                          className="text-[9px] font-semibold uppercase rounded-full px-1.5 py-[1px] flex-shrink-0 ml-auto"
                          style={{ background: "rgba(255,255,255,0.1)", letterSpacing: "0.04em" }}
                        >
                          Em breve
                        </span>
                      </div>
                    );
                  }
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className="flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[13.5px] no-underline"
                      style={{
                        color: active ? "#ffffff" : "var(--dark-fg-muted)",
                        background: active ? "rgba(255,255,255,0.12)" : "transparent",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <Icon size={17} strokeWidth={1.75} className="flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.comingSoon && (
                        <span
                          className="text-[9px] font-semibold uppercase rounded-full px-1.5 py-[1px] flex-shrink-0 ml-auto"
                          style={{ background: "rgba(255,255,255,0.1)", color: "var(--dark-fg-muted)", letterSpacing: "0.04em" }}
                        >
                          Em breve
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
      </nav>
    </aside>
  );
}
