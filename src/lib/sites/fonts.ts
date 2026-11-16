import type { Theme } from "@/lib/sites/content";
import { Anton, Archivo, Barlow_Condensed, Bodoni_Moda, Cormorant_Garamond, DM_Sans, DM_Serif_Display, IBM_Plex_Mono, IBM_Plex_Sans, Inter, Lora, Manrope, Montserrat, Newsreader, Open_Sans, Playfair_Display, Poppins, Saira, Source_Sans_3, Nunito, Baloo_2, Jost } from "next/font/google";

// Self-hosted at build time: no request to Google from visitors' browsers.
// preload: false because each site uses only one pair. next/font requires literal options.
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-inter" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-manrope" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-playfair" });
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-lora" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-source-sans" });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-montserrat" });
// Italics too: the "segoe-open-sans" pair stands in for Segoe UI, whose headings are often italic.
const openSans = Open_Sans({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--f-open-sans" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--f-dm-serif" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-dm-sans" });
// Variable width: the "impacto" style sets the headings to an expanded width.
const archivo = Archivo({ subsets: ["latin"], display: "swap", preload: false, axes: ["wdth"], variable: "--f-archivo" });
const barlow = Barlow_Condensed({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600", "700", "800"], variable: "--f-barlow" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], display: "swap", preload: false, weight: ["300", "400", "500", "600"], variable: "--f-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500"], variable: "--f-plex-mono" });
// Variable weight and width: light and black cuts side by side in "engenharia" headings.
const saira = Saira({ subsets: ["latin"], display: "swap", preload: false, axes: ["wdth"], variable: "--f-saira" });
const poppins = Poppins({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700", "800"], variable: "--f-poppins" });
// Variable weight with true italics: "italic" headlines set the highlight in it.
const newsreader = Newsreader({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--f-newsreader" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600", "700"], variable: "--f-cormorant" });
// Without the optical size axis: the default cut keeps its thin strokes visible at heading sizes.
// Condensed caps like the captions of animated shorts, with a rounded, friendly body.
const anton = Anton({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--f-anton" });
const nunito = Nunito({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-nunito" });
const baloo = Baloo_2({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-baloo" });
// Geometric in the manner of Futura, light to bold: wide clean letters for clinics and studios whose logo is set in it.
const jost = Jost({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-jost" });
const bodoni = Bodoni_Moda({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-bodoni" });

export const fontVariables = [anton, nunito, baloo, inter, manrope, playfair, lora, sourceSans, montserrat, openSans, dmSerif, dmSans, cormorant, bodoni, jost, newsreader, barlow, archivo, saira, poppins, plexSans, plexMono]
  .map((f) => f.variable)
  .join(" ");

/** `system`: a font taken from the visitor's computer (never served by us), ahead of the pair's own. */
const PAIRS: Record<Theme["fontPair"], { heading: string; body: string; mono?: string; system?: string; headingWeight?: string }> = {
  inter: { heading: "--f-inter", body: "--f-inter" },
  manrope: { heading: "--f-manrope", body: "--f-manrope" },
  "playfair-inter": { heading: "--f-playfair", body: "--f-inter" },
  "lora-source-sans": { heading: "--f-lora", body: "--f-source-sans" },
  "montserrat-open-sans": { heading: "--f-montserrat", body: "--f-open-sans" },
  "dm-serif-dm-sans": { heading: "--f-dm-serif", body: "--f-dm-sans" },
  "cormorant-montserrat": { heading: "--f-cormorant", body: "--f-montserrat" },
  montserrat: { heading: "--f-montserrat", body: "--f-montserrat" },
  "barlow-inter": { heading: "--f-barlow", body: "--f-inter" },
  "archivo-inter": { heading: "--f-archivo", body: "--f-inter" },
  "archivo-plex": { heading: "--f-archivo", body: "--f-plex-sans", mono: "--f-plex-mono" },
  "saira-plex": { heading: "--f-saira", body: "--f-plex-sans", mono: "--f-plex-mono" },
  poppins: { heading: "--f-poppins", body: "--f-poppins" },
  "newsreader-inter": { heading: "--f-newsreader", body: "--f-inter" },
  "bodoni-poppins": { heading: "--f-bodoni", body: "--f-poppins", headingWeight: "500" },
  "poppins-open-sans": { heading: "--f-poppins", body: "--f-open-sans", headingWeight: "700" },
  "anton-nunito": { heading: "--f-anton", body: "--f-nunito", headingWeight: "400" },
  "anton-baloo": { heading: "--f-anton", body: "--f-baloo", headingWeight: "400" },
  jost: { heading: "--f-jost", body: "--f-jost" },
  "segoe-open-sans": { heading: "--f-open-sans", body: "--f-open-sans", system: '"Segoe UI", "Segoe UI Variable Text"' },
};

export function fontPairVariables(pair: Theme["fontPair"]): Record<string, string> {
  const { heading, body, mono, system, headingWeight } = PAIRS[pair];
  const own = system ? `${system}, ` : "";
  return {
    ...(headingWeight ? { "--font-heading-weight": headingWeight } : {}),
    ...(mono ? { "--font-mono-family": `var(${mono}), ui-monospace, SFMono-Regular, Menlo, monospace` } : {}),
    "--font-heading-family": `${own}var(${heading}), ui-serif, Georgia, serif`,
    "--font-body-family": `${own}var(${body}), ui-sans-serif, system-ui, sans-serif`,
  };
}

/** @font-face rules for the theme's own typeface; names and paths are schema-checked, so they are safe to inline. */
export function customFontFaces(font: Theme["customFont"]): string {
  if (!font) return "";
  return font.files
    .map((f) => `@font-face{font-family:"${font.name}";src:url("${f.src}") format("woff2");font-weight:${f.weight};font-style:normal;font-display:swap}`)
    .join("");
}

/** The theme's own typeface ahead of the pair's family, where the theme asks for it. */
export function customFontVariables(font: Theme["customFont"], pair: Theme["fontPair"]): Record<string, string> {
  if (!font) return {};
  const base = fontPairVariables(pair);
  const own = `"${font.name}"`;
  return {
    ...(font.use !== "body" ? { "--font-heading-family": `${own}, ${base["--font-heading-family"]}` } : {}),
    ...(font.use !== "heading" ? { "--font-body-family": `${own}, ${base["--font-body-family"]}` } : {}),
  };
}
