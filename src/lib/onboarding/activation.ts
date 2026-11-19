import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PACK_KEY, getPack } from "@/packs/registry";
import { SITES_ENABLED } from "@/lib/features";

type Tx = Prisma.TransactionClient;

export type ActivationStep = { key: string; label: string; hint: string; href: string; done: boolean; optional?: boolean };

/*
 * Primeiros passos da conta: cada item é calculado a partir do que a conta JÁ tem (nada de caixinha
 * marcada à mão), então o checklist nunca mente nem fica desatualizado. A ordem é a jornada de quem
 * acabou de assinar: dizer quem é, achar clientes, trabalhar o primeiro lead, aparecer na internet,
 * produzir conteúdo e chamar o time.
 */
export async function getActivationSteps(tx: Tx, organizationId: string): Promise<ActivationStep[]> {
  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { city: true, state: true, segment: true, responsibleName: true, professionalRegistration: true } });
  const installed = await tx.organizationPack.findUnique({ where: { organizationId }, select: { packKey: true } });
  const pack = getPack(installed?.packKey) ?? getPack(DEFAULT_PACK_KEY);
  const needsRegistration = Boolean(pack?.site?.requireRegistration || pack?.contentSignature);

  const [icps, searchRuns, scores, deals, publishedSites, drafts, members] = await Promise.all([
    tx.iCP.count({ where: { organizationId } }),
    tx.searchRun.count({ where: { organizationId } }),
    tx.opportunityScore.count({ where: { organizationId } }),
    tx.opportunity.count({ where: { organizationId } }),
    tx.site.count({ where: { organizationId, publishedVersionId: { not: null } } }),
    tx.contentDraft.count({ where: { organizationId, body: { not: "" } } }),
    tx.membership.count({ where: { organizationId } }),
  ]);

  const profileDone = Boolean(org.city && org.state && org.segment) && (!needsRegistration || Boolean(org.responsibleName && org.professionalRegistration));

  return [
    { key: "perfil", label: "Completar o perfil da empresa", hint: needsRegistration ? "Cidade, segmento, responsável técnico e registro profissional." : "Cidade, estado e segmento.", href: "/settings/empresa", done: profileDone },
    { key: "icp", label: "Definir quem é o seu cliente ideal", hint: "A busca usa isso para achar empresas com cara de cliente.", href: "/settings/icp", done: icps > 0 },
    { key: "busca", label: "Encontrar as primeiras oportunidades", hint: "Rode a busca por IA e veja as empresas com sinais de compra.", href: "/oportunidades", done: searchRuns > 0 || scores > 0 },
    { key: "funil", label: "Colocar o primeiro lead no funil", hint: "Mova uma oportunidade para o CRM ou cadastre um lead.", href: "/leads", done: deals > 0 },
    ...(SITES_ENABLED ? [{ key: "site", label: "Publicar o seu site", hint: "O Spinos monta o site e as páginas de captação a partir de poucas respostas.", href: "/meu-site", done: publishedSites > 0 }] : []),
    { key: "conteudo", label: "Gerar o primeiro conteúdo", hint: "Uma ideia de post ou um artigo como rascunho para você revisar.", href: "/conteudo", done: drafts > 0 },
    { key: "equipe", label: "Convidar quem vai atender os leads", hint: "Opcional, mas cada lead precisa de um responsável.", href: "/settings/equipe", done: members > 1, optional: true },
  ];
}

export function activationProgress(steps: ActivationStep[]) {
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  return { done, total: required.length, complete: done === required.length, next: steps.find((s) => !s.done && !s.optional) ?? null };
}
