import { absoluteUrl } from "@/lib/sites/seo";
import { loadSite } from "@/lib/sites/source";

// Per-host output: never prerender (Next treats sitemap/robots paths as static metadata by default).
export const dynamic = "force-dynamic";

/** Crawlers of AI assistants and AI search, named explicitly so being quoted by them is a deliberate choice. */
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"];

export async function GET(_request: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const result = await loadSite(host);
  if (result.status !== "found") return new Response("Not found", { status: 404 });

  const { site } = result;
  // Temporary and secondary hosts are never indexed; only the primary domain of a live site is.
  const allow = site.indexable && host === site.primaryHostname;
  const body = allow
    ? [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "",
        ...AI_CRAWLERS.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", ""]),
        `Sitemap: ${absoluteUrl(site, "/sitemap.xml")}`,
        `# Resumo para assistentes de IA: ${absoluteUrl(site, "/llms.txt")}`,
        "",
      ].join("\n")
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
