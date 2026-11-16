import type { Section } from "@/lib/sites/content";
import { LOCALE_LABELS } from "@/lib/sites/content";
import { absoluteUrl, pagePath } from "@/lib/sites/seo";
import { loadSite } from "@/lib/sites/source";

export const dynamic = "force-dynamic";

/**
 * /llms.txt: a plain-language briefing for AI assistants (llmstxt.org
 * convention). Built only from published content, so it never states
 * anything the site itself doesn't.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const result = await loadSite(host);
  if (result.status !== "found") return new Response("Not found", { status: 404 });

  const { site } = result;
  const { business, pages, seo, blog } = site.content;
  const lines: string[] = [`# ${business.name}`, ""];
  if (seo.description || business.tagline) lines.push(`> ${seo.description ?? business.tagline}`, "");

  const facts = [
    business.foundingYear ? `Atuação desde ${business.foundingYear}.` : null,
    business.address ? `Endereço: ${[business.address.street, `${business.address.city} – ${business.address.state}`, business.address.postalCode].filter(Boolean).join(", ")}.` : null,
    business.areasServed.length ? `Região de atendimento: ${business.areasServed.join(", ")}.` : null,
    business.expertise.length ? `Temas de atuação: ${business.expertise.join("; ")}.` : null,
    business.openingHours ? `Horário: ${business.openingHours}.` : null,
    business.phone ? `Telefone: +${business.phone}.` : null,
    business.email ? `E-mail: ${business.email}.` : null,
  ].filter(Boolean);
  if (facts.length) lines.push(...facts.map((f) => `- ${f}`), "");

  // Service pages first and on their own: they are what an assistant is asked about.
  const visible = pages.filter((p) => !p.seo.noindex);
  const link = (p: (typeof pages)[number]) => `- [${p.title}](${absoluteUrl(site, pagePath(p.slug))})${p.seo.description ? `: ${p.seo.description}` : ""}`;
  const services = visible.filter((p) => p.seo.kind === "service");
  if (services.length) lines.push("## Serviços", "", ...services.map(link), "");
  lines.push("## Páginas", "", ...visible.filter((p) => p.seo.kind !== "service").map(link), "");

  if (blog && site.posts.length) {
    lines.push(`## ${blog.title}`, "");
    for (const post of site.posts) lines.push(`- [${post.title}](${absoluteUrl(site, `/${blog.slug}/${post.slug}`)}): ${post.excerpt}`);
    lines.push("");
  }

  if (site.languages.length) {
    lines.push("## Outros idiomas", "");
    for (const l of site.languages) lines.push(`- [${LOCALE_LABELS[l].name}](${absoluteUrl(site, `/${l}`)})`);
    lines.push("");
  }

  const faqs = pages.flatMap((p) => p.sections).filter((s): s is Extract<Section, { type: "faq" }> => s.type === "faq" && !s.hidden).flatMap((s) => s.items);
  if (faqs.length) {
    lines.push("## Perguntas frequentes", "");
    for (const q of faqs) lines.push(`### ${q.question}`, "", q.answer, "");
  }

  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
