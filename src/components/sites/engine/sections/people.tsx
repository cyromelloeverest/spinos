import type { CSSProperties } from "react";
import type { Section } from "@/lib/sites/content";
import { type RenderContext, resolveImage } from "../context";
import { Icon } from "../icons";
import { Container, Picture, SectionShell, SectionTitle, toneOf } from "../ui";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

export function CredentialsSection({ section, ctx }: { section: Of<"credentials">; ctx: RenderContext }) {
  const grid = section.variant === "grid";
  return (
    <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage} className="!py-20">
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="mb-12" />
        <ul className={grid ? "credentials-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>li]:rounded-[var(--brand-radius)] [&>li]:border [&>li]:border-[var(--line)]" : "credentials-list max-w-3xl divide-y divide-[var(--line)] border-y border-[var(--line)]"}>
          {section.items.map((item) => (
            <li key={item.title} className={`reveal flex gap-4 ${grid ? "card-surface p-7" : "py-5"}`}>
              <Icon name="check" className="credential-mark mt-1 size-5 shrink-0 text-brand-text" />
              <div>
                <p className="credential-title text-lg font-semibold">{item.title}</p>
                {item.detail && <p className="mt-1 text-muted">{item.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}

export function StepsSection({ section, ctx }: { section: Of<"steps">; ctx: RenderContext }) {
  const cards = section.variant === "cards";
  // "letters": the initial of each step, large, as in a named method (N-O-R-T-E).
  if (section.variant === "letters") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
          <ol
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(var(--steps),minmax(0,1fr))]"
            style={{ "--steps": section.items.length } as CSSProperties}
          >
            {section.items.map((step) => (
              <li key={step.title} className="numbered-card reveal flex flex-col rounded-[var(--brand-radius)] border p-6">
                <span aria-hidden className="font-heading text-6xl font-bold leading-none text-brand-text">{step.title.charAt(0).toUpperCase()}</span>
                <h3 className="mt-6 font-heading text-lg font-semibold">{step.title}</h3>
                {step.description && <p className="mt-2 text-[0.95rem] leading-relaxed text-muted whitespace-pre-line">{step.description}</p>}
              </li>
            ))}
          </ol>
        </Container>
      </SectionShell>
    );
  }
  // "path": numbered glass nodes on a gradient line, each step in a translucent card. Made for dark panels.
  if (section.variant === "path") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
          <ol
            className="relative grid gap-5 lg:grid-cols-[repeat(var(--steps),minmax(0,1fr))] lg:gap-5"
            style={{ "--steps": section.items.length } as CSSProperties}
          >
            <span aria-hidden className="path-line absolute top-7 right-0 left-7 hidden h-px lg:block" />
            {section.items.map((step, i) => (
              <li key={step.title} className="group reveal relative flex gap-5 lg:block">
                <span className="path-node relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border font-heading text-lg font-semibold transition duration-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="path-card flex-1 rounded-[calc(var(--brand-radius)*1.2)] border p-6 transition duration-300 group-hover:-translate-y-1 lg:mt-6">
                  <h3 className="font-heading text-xl font-semibold">{step.title}</h3>
                  {step.description && <p className="mt-3 text-[0.95rem] leading-relaxed text-muted whitespace-pre-line">{step.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </SectionShell>
    );
  }
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
        {cards ? (
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {section.items.map((step, i) => (
              <li key={step.title} className="reveal relative overflow-hidden rounded-[var(--brand-radius)] border border-[var(--line)] card-surface p-8">
                <span aria-hidden className="pointer-events-none absolute -top-4 -right-1 font-heading text-8xl font-bold text-brand/10">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-text">Etapa {i + 1}</span>
                <h3 className="mt-3 font-heading text-2xl font-semibold">{step.title}</h3>
                {step.description && <p className="mt-3 leading-relaxed text-muted whitespace-pre-line">{step.description}</p>}
              </li>
            ))}
          </ol>
        ) : (
          // Horizontal timeline on wide screens, vertical on phones.
          <ol className={`grid gap-10 lg:gap-8 ${section.items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {section.items.map((step, i) => (
              <li key={step.title} className="reveal relative border-l border-[var(--line)] pl-8 lg:border-t lg:border-l-0 lg:pt-10 lg:pl-0">
                <span className="absolute top-0 -left-[1.1rem] flex size-9 items-center justify-center rounded-full bg-brand font-heading text-sm font-bold text-brand-contrast lg:-top-[1.15rem] lg:left-0">
                  {i + 1}
                </span>
                <h3 className="font-heading text-[1.75rem] font-semibold leading-tight">{step.title}</h3>
                {step.description && <p className="mt-3 leading-relaxed text-muted whitespace-pre-line">{step.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </Container>
    </SectionShell>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

function Portrait({ member, ctx, large }: { member: Of<"team">["members"][number]; ctx: RenderContext; large: boolean }) {
  const photo = resolveImage(ctx, member.photo);
  const frame = `w-full rounded-[var(--brand-radius)] ${large ? "aspect-[4/5]" : "aspect-[3/4]"}`;
  if (photo) {
    return (
      <Picture
        image={{ ...photo, alt: photo.alt || member.name }}
        sizes={large ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
        className={`team-portrait ${frame} object-cover object-top grayscale-[35%] transition duration-500 group-hover:grayscale-0`}
      />
    );
  }
  return (
    <div aria-hidden className={`${frame} brand-pattern flex items-center justify-center`}>
      <span className="font-heading text-5xl font-semibold tracking-wider text-white/85">{initials(member.name)}</span>
    </div>
  );
}

function LeadPhoto({ member, ctx }: { member: Of<"team">["members"][number]; ctx: RenderContext }) {
  const photo = resolveImage(ctx, member.photo);
  if (!photo) return <Portrait member={member} ctx={ctx} large />;
  return (
    <Picture
      image={{ ...photo, alt: photo.alt || member.name }}
      sizes="(min-width: 1024px) 40vw, 100vw"
      className="absolute inset-x-0 bottom-0 h-[94%] w-full object-contain object-bottom transition duration-700 ease-out group-hover:scale-[1.03] [transform-origin:bottom]"
    />
  );
}

function MemberInfo({ member, large }: { member: Of<"team">["members"][number]; large: boolean }) {
  return (
    <>
      <h3 className={`font-heading font-semibold tracking-tight ${large ? "text-4xl sm:text-5xl" : "text-[1.7rem] leading-tight"}`}>{member.name}</h3>
      {member.role && <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-brand-text">{member.role}</p>}
      {member.registration && <p className="mt-2 text-sm text-muted">{member.registration}</p>}
      {member.bio && <p className={`mt-5 leading-relaxed text-muted whitespace-pre-line ${large ? "text-lg" : ""}`}>{member.bio}</p>}
      {member.linkedin && (
        <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-text">
          <Icon name="linkedin" className="size-4" /> LinkedIn
        </a>
      )}
    </>
  );
}

export function TeamSection({ section, ctx }: { section: Of<"team">; ctx: RenderContext }) {
  const featured = section.variant === "featured";
  const [lead, ...rest] = section.members;
  const others = featured ? rest : section.members;
  return (
    <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
        {featured && lead && (
          <div className="group reveal grid items-center gap-12 lg:grid-cols-[2fr_3fr]">
            {ctx.site.theme.style === "layered" ? (
              // The person stands on a lit brand panel (cut-out photos never float on the page).
              <div className="lead-panel relative isolate aspect-[4/5] overflow-hidden rounded-[calc(var(--brand-radius)*1.2)] rounded-tr-[var(--panel-radius)]">
                <svg aria-hidden viewBox="0 0 400 400" className="deco-ring pointer-events-none absolute top-[12%] left-1/2 -z-10 w-[88%] -translate-x-1/2">
                  <circle cx="200" cy="200" r="196" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M200 4 A196 196 0 0 1 396 200" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                </svg>
                <LeadPhoto member={lead} ctx={ctx} />
              </div>
            ) : (
              <div className="relative">
                <div aria-hidden className="absolute -bottom-4 -left-4 h-full w-full rounded-[var(--brand-radius)] border-2 border-brand/50" />
                <div className="relative">
                  <Portrait member={lead} ctx={ctx} large />
                </div>
              </div>
            )}
            <div>
              <MemberInfo member={lead} large />
            </div>
          </div>
        )}
        {others.length > 0 && (
          <ul className={`team-grid grid gap-8 sm:grid-cols-2 ${others.length === 5 ? "lg:grid-cols-5" : others.length >= 4 ? "lg:grid-cols-4" : others.length === 3 ? "lg:grid-cols-3" : "lg:max-w-4xl"} ${featured ? "mt-20" : ""}`}>
            {others.map((m) => (
              <li key={m.name} className="group reveal">
                <Portrait member={m} ctx={ctx} large={false} />
                <div className="mt-5">
                  <MemberInfo member={m} large={false} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </SectionShell>
  );
}
