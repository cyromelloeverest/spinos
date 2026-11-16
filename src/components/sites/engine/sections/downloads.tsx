import type { Section } from "@/lib/sites/content";
import { type RenderContext, resolveImage } from "../context";
import { Icon } from "../icons";
import { ui } from "../i18n";
import { Container, CtaButton, Eyebrow, Highlighted, Picture, SectionShell, SectionTitle, headingTag, headingWeight, toneOf } from "../ui";
import { CopyButton } from "./copy-button";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;
type Downloads = Of<"downloads">;
type DownloadFile = Downloads["files"][number];
type Item = Downloads["items"][number];

/** Wider than this, a preview goes to the row of banners instead of the row of posts. */
const BANNER_RATIO = 1.4;

function FileButton({ file, kind, big = false }: { file: DownloadFile; kind: "solid" | "soft"; big?: boolean }) {
  return (
    <a href={file.file} download className={`kit-file kit-file-${kind} ${big ? "kit-file-big" : ""}`}>
      <Icon name="download" className={big ? "size-5" : "size-4"} strokeWidth={2} />
      <span>{file.label}</span>
      {file.size && <span className="kit-file-size">{file.size}</span>}
    </a>
  );
}

function Bundle({ section, ctx }: { section: Downloads; ctx: RenderContext }) {
  const Heading = headingTag(ctx);
  const images = section.images.map((ref) => resolveImage(ctx, ref)).filter((image) => image !== null);
  return (
    <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage} className="kit-bundle overflow-hidden">
      <Container className="relative grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Eyebrow>{section.eyebrow}</Eyebrow>
          {section.heading && (
            <Heading className={`font-heading text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl ${headingWeight(ctx)}`}>
              <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
            </Heading>
          )}
          {section.intro && <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty">{section.intro}</p>}
          {section.files.length > 0 && (
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {section.files.map((file, i) => (
                <FileButton key={file.file} file={file} kind={i === 0 ? "solid" : "soft"} big={i === 0} />
              ))}
            </div>
          )}
          {section.autoDownload && section.files.length > 0 && (
            // Arriving from a sign-up form (?obrigado=1): the first file starts by itself, once per sign-up.
            <script
              dangerouslySetInnerHTML={{
                __html: `(function(){var q=new URLSearchParams(location.search);if(q.get("obrigado")!=="1")return;var k="auto-dl:"+(q.get("t")||"");try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1")}catch(e){}var a=document.querySelector(${JSON.stringify(`#${section.id} a.kit-file`)});if(a)setTimeout(function(){a.click()},600)})();`,
              }}
            />
          )}
          {section.facts.length > 0 && (
            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-2 text-sm text-muted">
              {section.facts.map((fact) => (
                <li key={fact} className="flex items-center gap-2">
                  <Icon name="check" className="size-4 text-brand-text" strokeWidth={2.2} />
                  {fact}
                </li>
              ))}
            </ul>
          )}
          {section.cta && (
            <div className="mt-8">
              <CtaButton ctx={ctx} cta={section.cta} variant="ghost" />
            </div>
          )}
        </div>
        {images.length > 0 && (
          <div aria-hidden className={`kit-fan kit-fan-${images.length}`}>
            {images.map((image) => (
              <Picture key={image.src} image={{ ...image, alt: "" }} sizes="(min-width: 1024px) 24vw, 45vw" priority className="kit-fan-piece" />
            ))}
          </div>
        )}
      </Container>
    </SectionShell>
  );
}

function PieceCard({ item, ctx, wide }: { item: Item; ctx: RenderContext; wide: boolean }) {
  const image = resolveImage(ctx, item.image);
  const first = item.files[0]!;
  return (
    <li className="kit-card reveal flex flex-col overflow-hidden rounded-[var(--brand-radius)] border border-[var(--line)] card-surface">
      {image && (
        <a href={first.file} download aria-label={`${first.label}: ${item.title}`} className={`kit-frame ${wide ? "aspect-[16/7]" : "aspect-[4/5]"}`}>
          <Picture image={{ ...image, alt: item.image?.alt ?? "" }} sizes={wide ? "(min-width: 1024px) 30vw, 90vw" : "(min-width: 1024px) 22vw, 45vw"} className="kit-frame-piece" />
          <span aria-hidden className="kit-frame-hint">
            <Icon name="download" className="size-5" strokeWidth={2} />
          </span>
        </a>
      )}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-lg font-semibold leading-snug">{item.title}</h3>
        {item.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.description}</p>}
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {item.files.map((file, i) => (
            <FileButton key={file.file} file={file} kind={i === 0 ? "solid" : "soft"} />
          ))}
        </div>
      </div>
    </li>
  );
}

export function DownloadsSection({ section, ctx }: { section: Downloads; ctx: RenderContext }) {
  if (section.variant === "bundle") return <Bundle section={section} ctx={ctx} />;
  const title = <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />;

  if (section.variant === "list") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          {title}
          <ul className="border-t border-[var(--line)]">
            {section.items.map((item) => (
              <li key={item.title} className="flex flex-col gap-4 border-b border-[var(--line)] py-6 md:flex-row md:items-center md:justify-between md:gap-10">
                <div>
                  <h3 className="font-heading text-lg font-semibold leading-snug">{item.title}</h3>
                  {item.description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{item.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.files.map((file) => (
                    <FileButton key={file.file} file={file} kind="soft" />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </SectionShell>
    );
  }

  // Posts and stories share one row, banners another: each row keeps a frame that suits its pieces.
  const isWide = (item: Item) => {
    const image = resolveImage(ctx, item.image);
    return Boolean(image && image.width / image.height > BANNER_RATIO);
  };
  const posts = section.items.filter((item) => !isWide(item));
  const banners = section.items.filter(isWide);
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        {title}
        {posts.length > 0 && (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {posts.map((item) => (
              <PieceCard key={item.title} item={item} ctx={ctx} wide={false} />
            ))}
          </ul>
        )}
        {banners.length > 0 && (
          <ul className={`grid gap-5 lg:grid-cols-3 ${posts.length > 0 ? "mt-5" : ""}`}>
            {banners.map((item) => (
              <PieceCard key={item.title} item={item} ctx={ctx} wide />
            ))}
          </ul>
        )}
      </Container>
    </SectionShell>
  );
}

/** The text with what the reader must replace, the [brackets], standing out. */
function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/).map((part, i) =>
        part.startsWith("[") && part.endsWith("]") ? (
          <mark key={i} className="kit-mark">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function SnippetsSection({ section, ctx }: { section: Of<"snippets">; ctx: RenderContext }) {
  const words = ui(ctx);
  return (
    <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
        <ul className="kit-snippets">
          {section.items.map((item) => (
            <li key={item.title} className="kit-snippet rounded-[var(--brand-radius)] border border-[var(--line)] card-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-heading text-lg font-semibold leading-snug">{item.title}</h3>
                  {item.usage && <p className="mt-1 text-sm text-muted">{item.usage}</p>}
                </div>
                <CopyButton text={item.text} label={words.copy} doneLabel={words.copied} />
              </div>
              <p className="mt-4 text-[0.95rem] leading-relaxed whitespace-pre-line">
                <Marked text={item.text} />
              </p>
              {item.translation && (
                <details className="kit-translation mt-4 border-t border-[var(--line)] pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-text">{item.translationLabel || "English"}</summary>
                  <p className="mt-3 text-[0.95rem] leading-relaxed whitespace-pre-line">
                    <Marked text={item.translation} />
                  </p>
                  <div className="mt-3">
                    <CopyButton text={item.translation} label={words.copy} doneLabel={words.copied} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}
