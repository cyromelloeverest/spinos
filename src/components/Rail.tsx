"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type OrgProfile = {
  name: string;
  segment: string | null;
  city: string | null;
  state: string | null;
} | null;

const navItems = [
  { href: "/", label: "Oportunidades", featured: true, icon: "🎯" },
  { href: "/news", label: "Portal de notícias", featured: true, icon: "📰" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/scripts", label: "Scripts de vendas" },
  { href: "/historico", label: "Histórico" },
];

const configItems = [
  { href: "/settings/empresa", label: "Perfil da empresa", enabled: true },
  { href: "/settings/icp", label: "Meu ICP", enabled: true },
  { href: "#", label: "Integrações", enabled: false },
];

const roadmapItems = [
  "Chat com IA sobre suas oportunidades",
  "Descoberta automática de concorrentes",
  "Exportar direto para CRM (HubSpot/Pipedrive)",
  "Alertas automáticos de novas oportunidades",
];

export function Rail({
  organization,
  signOutAction,
}: {
  organization: OrgProfile;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  function toggleTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current =
      document.documentElement.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
  }

  const displayName = organization?.name ?? "Configurar empresa";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const locationLine = [organization?.city, organization?.state].filter(Boolean).join(", ");

  return (
    <aside
      className="border-r flex flex-col gap-6 p-4 overflow-y-auto"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Link href="/" className="flex items-center gap-2.5 px-1.5 no-underline" style={{ color: "var(--fg)" }}>
        <div
          className="w-[18px] h-[18px] rounded-[4px] flex-shrink-0"
          style={{
            background: "linear-gradient(155deg, var(--copper), #a85a2a)",
          }}
        />
        <div className="text-[16px]" style={{ fontFamily: "var(--font-display)" }}>
          Spinos
        </div>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href;
          if (item.featured) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-2.5 py-[8px] rounded-[8px] text-[13.5px] font-semibold no-underline"
                style={{
                  color: "var(--copper)",
                  background: "var(--copper-soft)",
                  border: `1px solid ${active ? "var(--copper-line)" : "transparent"}`,
                }}
              >
                <span className="text-[13px] flex-shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13.5px] no-underline"
              style={{
                color: active ? "var(--fg)" : "var(--fg-muted)",
                background: active ? "var(--copper-soft)" : "transparent",
              }}
            >
              <span
                className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                style={{ background: active ? "var(--copper)" : "var(--fg-faint)" }}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div>
        <div
          className="text-[10.5px] uppercase px-2.5 mb-1.5"
          style={{ color: "var(--fg-faint)", letterSpacing: "0.07em" }}
        >
          Em breve
        </div>
        <div className="flex flex-col gap-0.5">
          {roadmapItems.map((label) => (
            <div
              key={label}
              className="flex items-start gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[12.5px] leading-[1.4]"
              style={{ color: "var(--fg-faint)" }}
            >
              <span
                className="w-[6px] h-[6px] rounded-full flex-shrink-0 mt-[5px]"
                style={{ border: "1px solid var(--border-strong)" }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div
          className="text-[10.5px] uppercase px-2.5 mb-1.5"
          style={{ color: "var(--fg-faint)", letterSpacing: "0.07em" }}
        >
          Configuração
        </div>
        <nav className="flex flex-col gap-0.5">
          {configItems.map((item) => {
            const active = pathname === item.href;
            if (!item.enabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13.5px]"
                  style={{ color: "var(--fg-faint)", opacity: 0.6, cursor: "default" }}
                >
                  <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: "var(--fg-faint)" }} />
                  {item.label}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13.5px] no-underline"
                style={{
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                  background: active ? "var(--copper-soft)" : "transparent",
                }}
              >
                <span
                  className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                  style={{ background: active ? "var(--copper)" : "var(--fg-faint)" }}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div
          className="rounded-[10px] border p-3 flex items-start gap-2.5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center border text-[10.5px] flex-shrink-0"
            style={{
              background: "var(--card-hover)",
              borderColor: "var(--border)",
              fontFamily: "var(--font-mono)",
              color: "var(--fg-muted)",
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold" style={{ color: "var(--fg)" }}>
              {displayName}
            </div>
            {organization?.segment && (
              <div className="text-[11px] mt-0.5 leading-[1.3]" style={{ color: "var(--fg-muted)" }}>
                {organization.segment}
              </div>
            )}
            {locationLine && (
              <div className="text-[10.5px] mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>
                {locationLine}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[11.5px] cursor-pointer"
              style={{ background: "none", border: "none", color: "var(--fg-faint)", padding: 0 }}
            >
              Sair
            </button>
          </form>
          <button
            onClick={toggleTheme}
            title="Alternar tema"
            className="w-[26px] h-[26px] rounded-[6px] border text-[13px] flex items-center justify-center cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg-muted)" }}
          >
            ◐
          </button>
        </div>
      </div>
    </aside>
  );
}
