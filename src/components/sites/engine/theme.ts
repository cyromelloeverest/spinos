import type { Theme } from "@/lib/sites/content";

const RADIUS: Record<Theme["radius"], string> = {
  none: "0px",
  sm: "4px",
  md: "10px",
  lg: "18px",
  full: "28px",
};

const SECTION_PADDING: Record<Theme["density"], string> = {
  compact: "4rem",
  comfortable: "6rem",
  spacious: "8rem",
};

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** White or near-black text, whichever reads better on `background` (WCAG contrast). */
export function readableOn(background: string): string {
  const l = luminance(background);
  const contrastWithWhite = 1.05 / (l + 0.05);
  const contrastWithBlack = (l + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#111111";
}

/**
 * CSS custom properties consumed by the section components. Every client's
 * look comes from these values — never from client-specific CSS.
 */
/**
 * The brand variables a single section overrides when it has its own accent
 * color. Custom properties inherit through the wrapper, so every tone rule
 * that reads them picks up the section color.
 */
export function accentVariables(color: string, darkBase: string): Record<string, string> {
  const onLight = readableOn(color) === "#111111" && luminance(color) > 0.6;
  return {
    "--brand-primary": color,
    "--brand-text": color,
    "--brand-bright": `color-mix(in srgb, ${color} 62%, white)`,
    "--brand-on-primary": readableOn(color),
    "--brand-on-white": onLight ? darkBase : color,
    "--brand-on-white-text": onLight ? "#ffffff" : readableOn(color),
  };
}

export function themeVariables(theme: Theme): Record<string, string> {
  const primary = theme.colors.primary;
  const accent = theme.colors.accent ?? theme.colors.secondary ?? primary;
  const dark = theme.mode === "dark";

  const darkBase = theme.dark ?? "#15171c";
  return {
    "--dark": darkBase,
    "--dark-raised": `color-mix(in srgb, ${darkBase} 86%, white)`,
    "--on-dark": "#f5f4f1",
    "--muted-on-dark": "rgb(245 244 241 / 0.68)",
    // Brand color lifted for text on dark backgrounds (a deep red on near-black is unreadable).
    "--brand-bright": `color-mix(in srgb, ${primary} 62%, white)`,
    "--brand-text": primary,
    "--brand-primary": primary,
    "--brand-on-primary": readableOn(primary),
    // Buttons on white cards (the lead form): a very light brand color would vanish there, so the dark tone takes over.
    "--brand-on-white": readableOn(primary) === "#111111" && luminance(primary) > 0.6 ? darkBase : primary,
    "--brand-on-white-text": readableOn(primary) === "#111111" && luminance(primary) > 0.6 ? "#ffffff" : readableOn(primary),
    "--brand-accent": accent,
    "--brand-secondary": theme.colors.secondary ?? accent,
    "--brand-on-accent": readableOn(accent),
    "--surface": dark ? "#0f1115" : "#ffffff",
    "--surface-alt": dark ? "#171a21" : "#f5f6f8",
    "--ink": dark ? "#f2f3f5" : "#14161a",
    "--muted": dark ? "#a3a9b5" : "#5b6270",
    "--line": dark ? "#2a2f3a" : "#e3e6eb",
    "--brand-radius": RADIUS[theme.radius],
    "--button-radius": theme.buttonStyle === "pill" ? "999px" : RADIUS[theme.radius],
    "--section-py": SECTION_PADDING[theme.density],
  };
}
