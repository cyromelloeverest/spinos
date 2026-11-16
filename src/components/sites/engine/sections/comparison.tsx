import type { Section } from "@/lib/sites/content";
import type { RenderContext } from "../context";
import { Icon } from "../icons";
import { Container, CtaButton, SectionShell, SectionTitle, toneOf } from "../ui";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

/** The usual way, muted and crossed out, beside this business's way, lit in the brand color. */
export function ComparisonSection({ section, ctx }: { section: Of<"comparison">; ctx: RenderContext }) {
  const column = (side: "before" | "after") => {
    const data = section[side];
    const after = side === "after";
    return (
      <div className={`compare-card reveal rounded-[calc(var(--brand-radius)*1.2)] border p-8 sm:p-10 ${after ? "compare-after" : ""}`}>
        <h3 className={`font-heading text-sm font-semibold tracking-[0.14em] uppercase ${after ? "text-brand-text" : "text-muted"}`}>{data.title}</h3>
        <ul className="mt-7 space-y-5">
          {data.items.map((item) => (
            <li key={item} className={`flex items-start gap-4 text-lg leading-snug ${after ? "font-medium" : "text-muted"}`}>
              <span
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${after ? "bg-brand text-brand-contrast" : "border border-current opacity-60"}`}
                aria-hidden
              >
                {after ? <Icon name="check" className="size-4" /> : <span className="block h-px w-3 bg-current" />}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
        <div className="grid gap-6 lg:grid-cols-2">
          {column("before")}
          {column("after")}
        </div>
        {section.cta && (
          <div className="reveal mt-10">
            <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
          </div>
        )}
      </Container>
    </SectionShell>
  );
}
