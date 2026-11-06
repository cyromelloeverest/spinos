import { HABILITACAO_CATEGORY_LABEL, type HabilitacaoCategoryKey } from "@/lib/licitacoes/habilitacao";
import type { TenderAnalysisResult } from "@/lib/licitacoes/analysis-schema";
import type { SourceCheck, SourceStatus } from "@/lib/licitacoes/analysis-verify";

type AnyCampo = { valor: string | boolean | null; tipo: "fato" | "interpretacao"; fonte: { documento: string; pagina: number; trecho_literal: string } | null; encontrado: boolean };

const STATUS_TEXT: Record<SourceStatus, string> = {
  ok: "Fonte conferida no documento",
  documento_nao_encontrado: "Documento citado não encontrado — não confirmado",
  pagina_inexistente: "Página citada não existe — não confirmado",
  trecho_nao_localizado: "Trecho não localizado na página citada — não confirmado",
  trecho_curto_demais: "Trecho curto demais para conferir — não confirmado",
  sem_fonte: "Sem fonte informada — não confirmado",
};

function valueText(v: string | boolean | null): string {
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return v;
}

function CampoView({ label, campo, path, check }: { label?: string; campo: AnyCampo; path: string; check: SourceCheck }) {
  const status = check.byPath[path];
  const confirmed = status === "ok";
  return (
    <div className="py-2.5">
      {label && (
        <div className="text-[11.5px] uppercase font-medium" style={{ color: "var(--fg-faint)", letterSpacing: "0.05em" }}>
          {label}
        </div>
      )}
      {!campo.encontrado ? (
        <div className="text-[13px]" style={{ color: "var(--fg-faint)" }}>
          Não encontrado no edital
        </div>
      ) : (
        <>
          <div className="text-[13.5px] leading-[1.55] break-words">{valueText(campo.valor)}</div>
          <div className="text-[11.5px] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <span style={{ color: campo.tipo === "fato" ? "var(--fg-muted)" : "var(--warn)" }}>{campo.tipo === "fato" ? "Consta no edital" : "Interpretação da IA"}</span>
            {campo.fonte && (
              <span style={{ color: "var(--fg-muted)" }}>
                {campo.fonte.documento}, p. {campo.fonte.pagina}
              </span>
            )}
            <span style={{ color: confirmed ? "var(--primary)" : "var(--critical)" }}>{status ? STATUS_TEXT[status] : "Não confirmado"}</span>
          </div>
          {campo.fonte && (
            <details className="mt-1">
              <summary className="text-[11.5px] cursor-pointer" style={{ color: "var(--primary)" }}>
                Ver trecho citado
              </summary>
              <blockquote className="m-0 mt-1 pl-3 text-[12.5px] leading-[1.55]" style={{ borderLeft: "2px solid var(--border-strong)", color: "var(--fg-muted)" }}>
                {campo.fonte.trecho_literal}
              </blockquote>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-[13.5px] font-semibold m-0 mb-1">{title}</h3>
      <div className="rounded-[12px] border px-4 divide-y" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        {children}
      </div>
    </div>
  );
}

const IDENT: Array<[keyof TenderAnalysisResult["identificacao"], string]> = [
  ["orgao", "Órgão"],
  ["objeto", "Objeto"],
  ["modalidade", "Modalidade"],
  ["numero_edital", "Número do edital"],
  ["criterio_julgamento", "Critério de julgamento"],
];
const PRAZOS: Array<[keyof TenderAnalysisResult["prazos"], string]> = [
  ["abertura_sessao", "Abertura da sessão"],
  ["limite_esclarecimentos", "Limite para esclarecimentos"],
  ["limite_impugnacao", "Limite para impugnação"],
  ["limite_propostas", "Limite para propostas"],
  ["validade_proposta", "Validade da proposta"],
  ["vigencia_contrato", "Vigência do contrato"],
  ["prazo_execucao", "Prazo de execução"],
  ["prazo_pagamento", "Prazo de pagamento"],
];
const VALORES: Array<[keyof TenderAnalysisResult["valores_e_condicoes"], string]> = [
  ["valor_estimado", "Valor estimado"],
  ["garantia_proposta", "Garantia da proposta"],
  ["garantia_contratual", "Garantia contratual"],
  ["visita_tecnica_exigida", "Visita técnica exigida"],
  ["exclusivo_me_epp", "Exclusivo para ME/EPP"],
  ["consorcio_permitido", "Consórcio permitido"],
  ["subcontratacao_permitida", "Subcontratação permitida"],
];
const SEVERITY: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

export function TenderAnalysisView({ result, sourceCheck }: { result: TenderAnalysisResult; sourceCheck: SourceCheck }) {
  const unverified = sourceCheck.total - sourceCheck.verified;
  return (
    <div>
      <div className="rounded-[8px] border px-4 py-3 text-[12.5px] leading-[1.6] mb-6" style={{ borderColor: unverified > 0 ? "var(--warn)" : "var(--border-strong)", color: "var(--fg-muted)" }}>
        {sourceCheck.verified} de {sourceCheck.total} informações tiveram a fonte conferida no texto dos documentos.
        {unverified > 0 && ` ${unverified} não puderam ser confirmadas e estão sinalizadas abaixo — confira no edital antes de usar.`} Esta análise é um apoio à decisão: não substitui a leitura do edital nem a revisão jurídica, e não indica se a sua empresa atende às exigências.
      </div>

      <Block title="Resumo">
        <CampoView campo={result.resumo} path="resumo" check={sourceCheck} />
      </Block>

      <Block title="Identificação">
        {IDENT.map(([k, label]) => (
          <CampoView key={k} label={label} campo={result.identificacao[k]} path={`identificacao.${k}`} check={sourceCheck} />
        ))}
      </Block>

      <Block title="Prazos">
        {PRAZOS.map(([k, label]) => (
          <CampoView key={k} label={label} campo={result.prazos[k]} path={`prazos.${k}`} check={sourceCheck} />
        ))}
      </Block>

      <Block title="Valores e condições">
        {VALORES.map(([k, label]) => (
          <CampoView key={k} label={label} campo={result.valores_e_condicoes[k]} path={`valores_e_condicoes.${k}`} check={sourceCheck} />
        ))}
      </Block>

      <Block title={`Habilitação exigida (${result.habilitacao_exigida.length})`}>
        {result.habilitacao_exigida.length === 0 && <div className="py-2.5 text-[13px]" style={{ color: "var(--fg-faint)" }}>Nenhuma exigência identificada.</div>}
        {result.habilitacao_exigida.map((h, i) => (
          <CampoView key={i} label={HABILITACAO_CATEGORY_LABEL[h.categoria as HabilitacaoCategoryKey]} campo={h.exigencia} path={`habilitacao_exigida.${i}.exigencia`} check={sourceCheck} />
        ))}
      </Block>

      <Block title={`Requisitos técnicos (${result.requisitos_tecnicos.length})`}>
        {result.requisitos_tecnicos.length === 0 && <div className="py-2.5 text-[13px]" style={{ color: "var(--fg-faint)" }}>Nenhum requisito técnico identificado.</div>}
        {result.requisitos_tecnicos.map((r, i) => (
          <CampoView key={i} campo={r} path={`requisitos_tecnicos.${i}`} check={sourceCheck} />
        ))}
      </Block>

      <Block title={`Riscos e pontos de atenção (${result.riscos.length})`}>
        {result.riscos.length === 0 && <div className="py-2.5 text-[13px]" style={{ color: "var(--fg-faint)" }}>Nenhum risco identificado.</div>}
        {result.riscos.map((r, i) => (
          <CampoView key={i} label={`Severidade ${SEVERITY[r.severidade] ?? r.severidade}`} campo={r.descricao} path={`riscos.${i}.descricao`} check={sourceCheck} />
        ))}
      </Block>

      {(result.lacunas.length > 0 || result.perguntas_para_esclarecimento.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <ListBlock title="Lacunas do edital" items={result.lacunas} />
          <ListBlock title="Perguntas sugeridas ao órgão" items={result.perguntas_para_esclarecimento} />
        </div>
      )}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-[13.5px] font-semibold m-0 mb-1">{title}</h3>
      <ul className="rounded-[12px] border m-0 py-3 pl-8 pr-4 text-[13px] leading-[1.6]" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
