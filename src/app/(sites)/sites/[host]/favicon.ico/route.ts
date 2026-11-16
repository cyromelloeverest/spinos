import { loadSite } from "@/lib/sites/source";

// Per-host output: each site answers /favicon.ico with its own icon.
export const dynamic = "force-dynamic";

/**
 * Browsers, bookmarks and search engines still ask for /favicon.ico even when the page declares its icon.
 * Each site answers with a redirect to its own favicon (the smallest size it has).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const result = await loadSite(host);
  if (result.status !== "found") return new Response("Not found", { status: 404 });
  const ref = result.site.content.business.favicon ?? result.site.content.business.logo;
  const image = ref ? result.site.media[ref.assetId] : undefined;
  if (!image) return new Response("Not found", { status: 404 });
  const src = smallestSource(image);
  return new Response(null, { status: 302, headers: { Location: src, "Cache-Control": "public, max-age=86400" } });
}

function smallestSource(image: { src: string; srcSet?: string }): string {
  const candidates = (image.srcSet ?? "")
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .flatMap(([url, width]) => (url && width?.endsWith("w") ? [{ url, width: Number.parseInt(width, 10) }] : []))
    .sort((a, b) => a.width - b.width);
  return candidates[0]?.url ?? image.src;
}
