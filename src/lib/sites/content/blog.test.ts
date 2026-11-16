import { describe, expect, it } from "vitest";
import { blogPostIssues, parseBlogPosts, publishedPosts, todayInBrazil } from "./blog";

const config = { slug: "insights", title: "Insights", categories: [{ slug: "geral", name: "Geral" }] };
const post = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug,
  title: `Artigo ${slug}`,
  excerpt: "Resumo.",
  category: "geral",
  publishedAt: "2026-01-10",
  body: [{ type: "p", text: "Texto." }],
  ...extra,
});

describe("blog posts", () => {
  it("sorts newest first and treats posts without status as published", () => {
    const posts = parseBlogPosts([post("a", { publishedAt: "2025-01-01" }), post("b")], config);
    expect(posts.map((p) => p.slug)).toEqual(["b", "a"]);
    expect(posts.every((p) => p.status === "published")).toBe(true);
  });

  it("keeps drafts away from visitors", () => {
    const posts = parseBlogPosts([post("pronto"), post("rascunho", { status: "draft" })], config);
    expect(publishedPosts(posts).map((p) => p.slug)).toEqual(["pronto"]);
  });

  it("points the editor at the field at fault", () => {
    const issues = blogPostIssues([post("a"), post("a"), post("b", { category: "nao-existe" }), post("c", { title: "" })], config);
    expect(issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["3.title"]));
    const semantic = blogPostIssues([post("a"), post("a"), post("b", { category: "nao-existe" })], config);
    expect(semantic.map((i) => i.path.join("."))).toEqual(["1.slug", "2.category"]);
  });
});

describe("scheduled posts and tags", () => {
  const config = { slug: "episodios", title: "Episódios", categories: [{ slug: "fabula", name: "Fábula" }], tags: [{ slug: "ze", name: "Zé" }] };
  const post = (slug: string, publishedAt: string, tags: string[] = []) => ({ slug, title: slug, excerpt: "x", category: "fabula", publishedAt, body: [{ type: "p", text: "x" }], tags });

  it("a post dated in the future stays hidden until its day in Brazil", () => {
    const posts = parseBlogPosts([post("hoje", "2026-11-08"), post("amanha", "2026-11-09")], config);
    expect(publishedPosts(posts, "2026-11-08").map((p) => p.slug)).toEqual(["hoje"]);
    expect(publishedPosts(posts, "2026-11-09").map((p) => p.slug)).toEqual(["amanha", "hoje"]);
  });

  it("midnight in São Paulo is still the previous day in UTC terms", () => {
    expect(todayInBrazil(new Date("2026-11-09T02:30:00Z"))).toBe("2026-11-08");
    expect(todayInBrazil(new Date("2026-11-09T03:30:00Z"))).toBe("2026-11-09");
  });

  it("rejects a tag the blog does not have", () => {
    expect(() => parseBlogPosts([post("a", "2026-11-08", ["leo"])], config)).toThrow(/Tag inexistente/);
    expect(parseBlogPosts([post("a", "2026-11-08", ["ze"])], config)[0]!.tags).toEqual(["ze"]);
  });
});
