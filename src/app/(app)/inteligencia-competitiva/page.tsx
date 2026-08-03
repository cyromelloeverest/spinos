import { redirect } from "next/navigation";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { ScanSearch, Eye, Radar as RadarIcon, Megaphone, Workflow, Rss } from "lucide-react";

const RAIO_X_ITEMS = [
  { icon: Megaphone, title: "Mídia paga", text: "Detecta pixels de anúncio instalados no site (Meta, Google, LinkedIn Ads) — ele está anunciando ou não." },
  { icon: Workflow, title: "Automação de marketing", text: "Identifica ferramentas de automação e captura de leads instaladas (RD Station, HubSpot, ActiveCampaign etc)." },
  { icon: ScanSearch, title: "Landing pages e iscas", text: "Encontra páginas de conversão no ar e qual isca (e-book, teste grátis, orçamento) está sendo oferecida." },
  { icon: Rss, title: "Ritmo de publicação", text: "Mede a frequência e os temas do blog/conteúdo publicado no último período." },
];

export default async function InteligenciaCompetitivaPage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[720px]">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          <ScanSearch size={20} strokeWidth={1.75} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-medium m-0" style={{ fontFamily: "var(--font-display)" }}>
              Inteligência Competitiva
            </h1>
            <span
              className="text-[10px] font-semibold uppercase rounded-full px-2 py-[2px]"
              style={{ background: "var(--warn-soft, #FEF3C7)", color: "var(--warn)", letterSpacing: "0.04em" }}
            >
              Em breve
            </span>
          </div>
        </div>
      </div>

      <p className="text-[14px] leading-[1.65] mb-8 max-w-[62ch]" style={{ color: "var(--fg-muted)" }}>
        Um raio-X completo dos seus concorrentes — o que eles fazem em marketing e, principalmente, se a IA
        recomenda vocês ou eles quando um comprador pergunta.
      </p>

      <h2 className="text-[11.5px] uppercase font-semibold m-0 mb-3.5" style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}>
        Raio-X de marketing do concorrente
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-9">
        {RAIO_X_ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-[12px] border p-4 flex gap-3"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <item.icon size={18} strokeWidth={1.75} style={{ color: "var(--primary)" }} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[13.5px] font-semibold mb-0.5">{item.title}</div>
              <div className="text-[12.5px] leading-[1.5]" style={{ color: "var(--fg-muted)" }}>
                {item.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-[11.5px] uppercase font-semibold m-0 mb-3.5" style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}>
        A parte que ninguém mede hoje
      </h2>
      <div
        className="rounded-[16px] border p-6 mb-9"
        style={{ borderColor: "var(--primary-line)", background: "var(--primary-soft)" }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <Eye size={18} strokeWidth={1.75} style={{ color: "var(--primary)" }} />
          <div className="text-[15px] font-semibold" style={{ color: "var(--primary)" }}>
            Share of AI Voice
          </div>
        </div>
        <p className="text-[13.5px] leading-[1.65] m-0 mb-3" style={{ color: "var(--fg)" }}>
          Mede em quantas respostas do ChatGPT, Claude, Gemini e Perplexity a sua marca aparece — comparado
          aos seus concorrentes — quando alguém pergunta sobre o problema que você resolve.
        </p>
        <p className="text-[13px] leading-[1.6] m-0" style={{ color: "var(--fg-muted)" }}>
          Hoje, 73% dos compradores B2B já usam IA na pesquisa antes de comprar. Se o nome da sua empresa
          não aparece na resposta, ela nunca chega a existir pra essa compra — não importa o quanto ela
          apareça no Google.
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <RadarIcon size={16} strokeWidth={1.75} style={{ color: "var(--fg-faint)" }} />
        <p className="text-[12.5px] m-0" style={{ color: "var(--fg-faint)" }}>
          Estamos avaliando essa funcionalidade. Em breve você poderá rodar essa análise direto por aqui.
        </p>
      </div>

      <button
        disabled
        className="mt-6 text-[13px] font-medium px-5 py-2.5 rounded-[12px] border"
        style={{
          cursor: "not-allowed",
          opacity: 0.5,
          background: "var(--card)",
          borderColor: "var(--border-strong)",
          color: "var(--fg)",
        }}
      >
        Em breve
      </button>
    </div>
  );
}
