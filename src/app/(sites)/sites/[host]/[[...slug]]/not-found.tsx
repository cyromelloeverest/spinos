import type { Metadata } from "next";
import { Container } from "@/components/sites/engine";

export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false } };

/** Shown inside the site's own layout (header, footer, colors) for unknown paths. */
export default function SiteNotFound() {
  return (
    <section className="tone-light py-32">
      <Container className="max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-text">Erro 404</p>
        <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Página não encontrada</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted">O endereço pode ter mudado ou não existe mais. Use o menu acima ou volte para o início.</p>
        <a href="/" className="mt-10 inline-flex min-h-12 items-center rounded-[var(--button-radius)] bg-brand px-7 text-sm font-semibold uppercase tracking-[0.12em] text-brand-contrast">
          Voltar para o início
        </a>
      </Container>
    </section>
  );
}
