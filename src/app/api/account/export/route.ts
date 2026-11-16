import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentUserId, getCurrentOrganizationId } from "@/lib/auth/current-org";
import { logSecurityEvent } from "@/lib/audit/log";

// Exportação de dados pessoais/da organização para atender ao direito de
// portabilidade (art. 18, V, LGPD). Inclui só o que é do próprio tenant —
// Company/Signal são entidades globais compartilhadas, não pertencem a essa
// organização, então não entram aqui (ver decisão de arquitetura no schema).
export async function GET() {
  const userId = await getCurrentUserId();
  const organizationId = await getCurrentOrganizationId();
  if (!userId || !organizationId) {
    return new Response("Não autenticado.", { status: 401 });
  }

  const [organization, icps, memberships, opportunityScores, extra] = await withOrgContext(organizationId, (tx) =>
    Promise.all([
      tx.organization.findUnique({ where: { id: organizationId } }),
      tx.iCP.findMany({ where: { organizationId } }),
      tx.membership.findMany({
        where: { organizationId },
        include: { user: { select: { name: true, email: true, role: true, phone: true } } },
      }),
      tx.opportunityScore.findMany({
        where: { organizationId },
        include: {
          company: { select: { name: true, city: true, state: true, site: true } },
          account: { include: { contacts: true, opportunities: { include: { stage: true }, orderBy: { createdAt: "desc" }, take: 1 } } },
        },
      }),
      // Os demais módulos: tudo que a organização produziu ou guardou fora da busca por IA.
      Promise.all([
        tx.contact.findMany({ where: { organizationId }, include: { account: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
        tx.opportunity.findMany({ where: { organizationId }, include: { stage: { select: { name: true } }, account: { select: { name: true } }, lossReason: { select: { label: true } } }, orderBy: { createdAt: "asc" } }),
        tx.site.findMany({ where: { organizationId }, include: { domains: { select: { hostname: true, kind: true, status: true } } } }),
        tx.contentDraft.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } }),
        tx.emailCampaign.findMany({ where: { organizationId }, select: { name: true, subject: true, body: true, audience: true, status: true, totalRecipients: true, startedAt: true, finishedAt: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
        tx.emailSuppression.findMany({ where: { organizationId }, select: { email: true, reason: true, createdAt: true } }),
        tx.campaign.findMany({ where: { organizationId, spendBRL: { not: null } }, select: { name: true, channel: true, spendBRL: true, startsAt: true }, orderBy: { startsAt: "asc" } }),
      ]),
    ]),
  );
  const [allContacts, deals, sites, drafts, emailCampaigns, suppressions, spend] = extra;

  if (!organization) {
    return new Response("Organização não encontrada.", { status: 404 });
  }

  const exportPayload = {
    exportadoEm: new Date().toISOString(),
    organizacao: {
      nome: organization.name,
      site: organization.site,
      cidade: organization.city,
      estado: organization.state,
      cnpj: organization.cnpj,
      telefone: organization.phone,
      plano: organization.plan,
      criadaEm: organization.createdAt,
    },
    equipe: memberships.map((m) => ({
      nome: m.user.name,
      email: m.user.email,
      cargo: m.user.role,
      telefone: m.user.phone,
      papelNaOrganizacao: m.role,
    })),
    perfisDeClienteIdeal: icps,
    contatos: allContacts.map((c) => ({ nome: c.name, cargo: c.jobTitle, email: c.email, telefone: c.phone, empresa: c.account?.name ?? null, baseLegal: c.legalBasis, pediuParaSair: c.optedOutAt, anonimizadoEm: c.anonymizedAt, cadastradoEm: c.createdAt })),
    negociacoes: deals.map((d) => ({ titulo: d.title, empresa: d.account.name, etapa: d.stage.name, situacao: d.status, valorEsperado: d.expectedValueBRL, valorGanho: d.wonValueBRL, motivoDaPerda: d.lossReason?.label ?? null, criadaEm: d.createdAt, fechadaEm: d.closedAt })),
    sites: sites.map((st) => ({ nome: st.name, modelo: st.templateKey, noAr: Boolean(st.publishedVersionId), enderecos: st.domains, conteudoDoRascunho: st.draft })),
    conteudoGeradoPorIA: drafts.map((d) => ({ tipo: d.kind, situacao: d.status, assunto: d.topic, titulo: d.title, texto: d.body, avisos: d.warnings, criadoEm: d.createdAt })),
    campanhasDeEmail: emailCampaigns,
    listaDeNaoReceber: suppressions,
    investimentosEmMarketing: spend,
    oportunidades: opportunityScores.map((o) => ({
      empresa: o.company.name,
      cidade: o.company.city,
      estado: o.company.state,
      site: o.company.site,
      score: o.score,
      urgencia: o.urgency,
      etapaPipeline: o.account?.opportunities[0]?.stage.key ?? null,
      resumo: o.headline,
      contatos: (o.account?.contacts ?? []).map((c) => ({
        nome: c.name,
        cargo: c.jobTitle,
        telefone: c.phone,
        email: c.email,
        principal: c.isPrimary,
        baseLegal: c.legalBasis,
        anonimizadoEm: c.anonymizedAt,
      })),
      decisorProvavel: o.decisionMaker,
      decisorEncontradoPelaIA: o.decisionMakerName,
    })),
  };

  await logSecurityEvent({
    type: "privacy.data_exported",
    actorUserId: userId,
    organizationId,
    targetId: organizationId,
  });

  return new Response(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="spinos-dados-${organization.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json"`,
    },
  });
}
