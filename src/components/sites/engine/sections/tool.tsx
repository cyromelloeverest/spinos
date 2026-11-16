import type { Section } from "@/lib/sites/content";
import type { RenderContext } from "../context";
import { Container, CtaButton, SectionShell, SectionTitle, toneOf } from "../ui";
import { ToolWidget } from "./tool-widget";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

/** Diagnostic, calculator, construction-waste estimate or checklist: the frame is server-rendered, the tool itself runs in the browser. */
export function ToolSection({ section, ctx }: { section: Of<"tool">; ctx: RenderContext }) {
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div className="reveal lg:sticky lg:top-28">
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="mb-0" />
          {section.cta && (
            <div className="mt-8">
              <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
            </div>
          )}
        </div>
        <ToolWidget
          id={section.id}
          variant={section.variant}
          label={section.heading ?? "Ferramenta"}
          questions={section.questions}
          results={section.results}
          items={section.items}
          defaults={section.defaults}
          waste={section.waste}
          note={section.note}
        />
      </Container>
    </SectionShell>
  );
}
