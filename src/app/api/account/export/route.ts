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

  const [organization, icps, memberships, opportunityScores] = await withOrgContext(organizationId, (tx) =>
    Promise.all([
      tx.organization.findUnique({ where: { id: organizationId } }),
      tx.iCP.findMany({ where: { organizationId } }),
      tx.membership.findMany({
        where: { organizationId },
        include: { user: { select: { name: true, email: true, role: true, phone: true } } },
      }),
      tx.opportunityScore.findMany({
        where: { organizationId },
        include: { company: { select: { name: true, city: true, state: true, site: true } } },
      }),
    ]),
  );

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
    oportunidades: opportunityScores.map((o) => ({
      empresa: o.company.name,
      cidade: o.company.city,
      estado: o.company.state,
      site: o.company.site,
      score: o.score,
      urgencia: o.urgency,
      etapaPipeline: o.stage,
      resumo: o.headline,
      contatoNome: o.contactName,
      contatoTelefone: o.contactPhone,
      contatoEmail: o.contactEmail,
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
