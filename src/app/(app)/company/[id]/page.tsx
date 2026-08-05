import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { moveToPipeline, dismissOpportunity } from "@/lib/actions/pipeline";
import { updateContactInfo } from "@/lib/actions/contact";
import { faviconUrl } from "@/lib/favicon";
import { SIGNAL_CATEGORY_LABEL } from "@/lib/signal-categories";
import { linkedinPersonSearchUrl, linkedinCompanySearchUrl } from "@/lib/linkedin";
import { LinkedInButton } from "@/components/LinkedInButton";
import { SpinosScore } from "@/components/SpinosScore";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { PIPELINE_STAGE_LABEL, type PipelineStage } from "@/lib/pipeline-stages";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organizationId = await getCurrentOrganizationId();

  const opp = await prisma.opportunityScore.findUnique({
    where: { id },
    include: {
      company: true,
      lastActionByUser: true,
      signalsUsed: { include: { signal: true }, orderBy: { signal: { detectedAt: "desc" } } },
    },
  });

  if (!opp || opp.organizationId !== organizationId) notFound();

  const icp = await prisma.iCP.findFirst({
    where: { organizationId: opp.organizationId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  const offeringOptions = [...new Set([...(icp?.servicesSold ?? []), ...(icp?.productsSold ?? [])])];
  const updateContactWithId = updateContactInfo.bind(null, opp.id);

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[760px]">
      <Link
        href="/oportunidades"
        className="text-[12.5px] mb-4.5 inline-flex items-center gap-1 no-underline"
        style={{ color: "var(--fg-muted)" }}
      >
        <ArrowLeft size={13} strokeWidth={2} />
        Oportunidades
      </Link>

      <div
        className="flex justify-between items-start gap-6 pb-5.5 border-b mb-6.5"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h1
            className="text-[27px] font-medium m-0 mb-1.5"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {opp.company.name}
          </h1>
          <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--fg-muted)" }}>
            <span>
              {opp.company.city}, {opp.company.state}
            </span>
            <LinkedInButton href={linkedinCompanySearchUrl(opp.company.name)} size="sm" />
          </div>
        </div>
        <div className="flex-shrink-0">
          <SpinosScore value={opp.score} variant="hero" />
        </div>
      </div>

      <Section title="Resumo executivo">
        <p
          className="text-[15px] leading-[1.65] m-0"
          style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
        >
          {opp.execSummary}
        </p>
      </Section>

      <Section title="Sinais que embasam esta análise">
        <div className="flex flex-col">
          {opp.signalsUsed.map(({ signal }, i) => (
            <div key={signal.id} className="grid gap-0" style={{ gridTemplateColumns: "90px 20px 1fr" }}>
              <div className="text-[11.5px] pt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>
                {signal.detectedAt.toISOString().slice(0, 10)}
              </div>
              <div className="flex flex-col items-center">
                <div className="w-[7px] h-[7px] rounded-full mt-1.5 flex-shrink-0" style={{ background: "var(--primary)" }} />
                {i < opp.signalsUsed.length - 1 && (
                  <div className="w-px flex-1 mt-1" style={{ background: "var(--border)" }} />
                )}
              </div>
              <div className="pb-5">
                <div className="text-[10.5px] uppercase mb-0.5" style={{ color: "var(--primary)", letterSpacing: "0.06em" }}>
                  {SIGNAL_CATEGORY_LABEL[signal.category] ?? signal.title}
                </div>
                <div className="text-[13.5px] leading-[1.5] mb-1">{signal.description}</div>
                {signal.sourceUrl && (
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11.5px] no-underline inline-flex items-center gap-1.5"
                    style={{ color: "var(--fg-faint)" }}
                  >
                    {faviconUrl(signal.sourceUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={faviconUrl(signal.sourceUrl)!}
                        alt=""
                        width={14}
                        height={14}
                        className="rounded-[3px]"
                      />
                    )}
                    Fonte
                    <ExternalLink size={11} strokeWidth={1.75} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Por que o Spinos Score é ${opp.score}`}>
        <div
          className="rounded-[10px] border px-5 py-4.5 text-[13.5px] leading-[1.65]"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg-muted)" }}
        >
          {opp.reasoning}
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-7.5">
        <Field label="Área provável comprando" value={opp.buyerArea ?? "—"} />
        <div>
          <div className="text-[11px] uppercase mb-1" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>
            Decisor provável
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-[14px]">{opp.contactName || opp.decisionMakerName || opp.decisionMaker || "—"}</div>
            {!opp.contactName && opp.decisionMakerName && (
              <span
                className="text-[10px] font-semibold uppercase rounded-full px-2 py-[2px]"
                style={{ background: "var(--primary-soft)", color: "var(--primary)", letterSpacing: "0.04em" }}
              >
                Encontrado pela IA
              </span>
            )}
            {(opp.contactName || opp.decisionMakerName || opp.decisionMaker) && (
              <LinkedInButton
                href={linkedinPersonSearchUrl(opp.contactName || opp.decisionMakerName || opp.decisionMaker || "", opp.company.name)}
                size="sm"
              />
            )}
          </div>
        </div>
      </div>

      <Section title="Como abordar">
        <p className="text-[14px] leading-[1.6] m-0" style={{ color: "var(--fg)" }}>
          {opp.suggestedApproach}
        </p>
      </Section>

      <Section title="Argumentos comerciais">
        <List items={opp.commercialArguments} markerColor="var(--primary)" />
      </Section>

      <Section title="Possíveis objeções">
        <List items={opp.objections} markerColor="var(--warn)" />
      </Section>

      <Section title="Dados de contato">
        <form action={updateContactWithId} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ContactField
              label="Nome do contato"
              name="contactName"
              defaultValue={opp.contactName ?? opp.decisionMakerName ?? ""}
              placeholder="Ex: Maria Silva"
            />
            <ContactField label="Telefone" name="contactPhone" defaultValue={opp.contactPhone ?? ""} placeholder="Ex: (19) 99999-0000" />
          </div>
          <ContactField label="E-mail" name="contactEmail" defaultValue={opp.contactEmail ?? ""} placeholder="Ex: maria@empresa.com.br" />
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
              Produto/serviço a oferecer
            </span>
            <select
              name="recommendedOffering"
              defaultValue={opp.recommendedOffering ?? ""}
              className="rounded-[10px] border px-3.5 h-[44px] text-[13.5px] outline-none"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
            >
              <option value="">Selecione...</option>
              {offeringOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="self-start text-[12.5px] font-semibold px-4 py-2 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
          >
            Salvar contato
          </button>
        </form>
      </Section>

      <div className="flex items-center gap-2.5 mt-1.5">
        {opp.stage ? (
          <>
            <div
              className="text-[12.5px] font-semibold rounded-full px-3.5 py-2"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              No pipeline: {PIPELINE_STAGE_LABEL[opp.stage as PipelineStage]}
            </div>
            {opp.lastActionByUser && (
              <span className="text-[12px]" style={{ color: "var(--fg-faint)" }}>
                por {opp.lastActionByUser.name || opp.lastActionByUser.email}
              </span>
            )}
            <Link href="/pipeline" className="text-[13px] inline-flex items-center gap-1 no-underline" style={{ color: "var(--fg-muted)" }}>
              Ver no pipeline
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </>
        ) : (
          <>
            <form action={moveToPipeline.bind(null, opp.id)}>
              <button
                type="submit"
                className="text-[13px] font-medium px-4 py-2.5 rounded-[12px] border cursor-pointer"
                style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}
              >
                Iniciar contato
              </button>
            </form>
            <form action={dismissOpportunity.bind(null, opp.id)}>
              <button
                type="submit"
                className="text-[13px] font-medium px-4 py-2.5 rounded-[12px] border cursor-pointer"
                style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
              >
                Descartar
              </button>
            </form>
          </>
        )}
        <Button disabled>Exportar para CRM (em breve)</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7.5">
      <h2
        className="text-[11.5px] uppercase font-semibold m-0 mb-3.5"
        style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function ContactField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded-[10px] border px-3.5 h-[44px] text-[13.5px] outline-none"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
      />
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase mb-1" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div className="text-[14px]">{value}</div>
    </div>
  );
}

function List({ items, markerColor }: { items: string[]; markerColor: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <div key={i} className="text-[13.5px] leading-[1.55] pl-4 relative" style={{ color: "var(--fg-muted)" }}>
          <span className="absolute left-0" style={{ color: markerColor }}>
            —
          </span>
          {item}
        </div>
      ))}
    </div>
  );
}

function Button({
  children,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className="text-[13px] font-medium px-4 py-2.5 rounded-[12px] border"
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...(primary
          ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }
          : { background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }),
      }}
    >
      {children}
    </button>
  );
}
