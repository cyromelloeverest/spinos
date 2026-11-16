import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// Garante a Conta da organização para uma empresa do cadastro global e
// devolve o id. Também registra o primeiro toque de origem quando a conta é
// nova. Seguro de repetir: o par (organizationId, companyId) é único.
export async function ensureAccountForCompany(
  tx: Tx,
  input: { organizationId: string; companyId: string; occurredAt?: Date },
): Promise<string> {
  const existing = await tx.account.findUnique({
    where: { organizationId_companyId: { organizationId: input.organizationId, companyId: input.companyId } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const company = await tx.company.findUniqueOrThrow({ where: { id: input.companyId } });
  const account = await tx.account.create({
    data: {
      organizationId: input.organizationId,
      companyId: company.id,
      name: company.name,
      cnpj: company.cnpj,
      site: company.site,
      city: company.city,
      state: company.state,
      segment: company.segment,
      lifecycle: "TARGET",
    },
    select: { id: true },
  });
  await tx.origin.create({
    data: {
      organizationId: input.organizationId,
      kind: "PROSPECTING",
      channel: "spinos",
      accountId: account.id,
      isFirstTouch: true,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
  return account.id;
}

// Filtro das notas que ainda são só "oportunidades encontradas", sem nenhuma
// negociação aberta nem fechada e que ninguém descartou. É o que antes era
// `stage: null, status != DISMISSED`.
export function untouchedScoresWhere(organizationId: string): Prisma.OpportunityScoreWhereInput {
  return {
    organizationId,
    status: { not: "DISMISSED" },
    OR: [{ accountId: null }, { account: { is: { opportunities: { none: {} } } } }],
  };
}

// Cria o contato "decisor" encontrado pela IA ou pelos dados públicos (nome e
// cargo), se a conta ainda não tem uma pessoa com esse nome. Sem base legal
// registrada: a tela mostra "a registrar" até alguém preencher.
export async function ensureDecisionMakerContact(
  tx: Tx,
  input: { organizationId: string; accountId: string; name: string | null | undefined; jobTitle?: string | null },
): Promise<void> {
  const name = input.name?.trim();
  if (!name) return;
  const existing = await tx.contact.findFirst({
    where: { organizationId: input.organizationId, accountId: input.accountId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return;
  await tx.contact.create({
    data: { organizationId: input.organizationId, accountId: input.accountId, name, jobTitle: input.jobTitle?.trim() || null, decisionRole: "decisor", isPrimary: false },
  });
}

// Notas "em andamento": ainda não trabalhadas ou com negociação aberta (fora as
// vendidas, perdidas e descartadas). Antes era `stage` nulo ou fora de
// VENDIDO/PERDIDO.
export function inProgressScoresWhere(organizationId: string): Prisma.OpportunityScoreWhereInput {
  return {
    organizationId,
    status: { not: "DISMISSED" },
    OR: [
      { accountId: null },
      { account: { is: { opportunities: { none: {} } } } },
      { account: { is: { opportunities: { some: { status: "OPEN" } } } } },
    ],
  };
}

// Contato principal da conta (o que aparece na ficha e nos roteiros).
export const PRIMARY_CONTACT_INCLUDE = { contacts: { where: { isPrimary: true }, take: 1 } } as const;

// Salva o contato principal da conta a partir do formulário da ficha. Com os três
// campos vazios, remove o contato principal (como antes, quando os campos
// voltavam a null). Se já existe um contato com o mesmo nome (por exemplo o
// decisor encontrado pela IA), ele vira o principal em vez de duplicar.
export async function savePrimaryContact(
  tx: Tx,
  input: { organizationId: string; accountId: string; name: string | null; phone: string | null; email: string | null },
): Promise<void> {
  const { organizationId, accountId } = input;
  const primary = await tx.contact.findFirst({ where: { organizationId, accountId, isPrimary: true } });

  if (!input.name && !input.phone && !input.email) {
    if (primary) {
      await tx.opportunity.updateMany({ where: { organizationId, primaryContactId: primary.id }, data: { primaryContactId: null } });
      await tx.contact.delete({ where: { id: primary.id } });
    }
    return;
  }

  const name = input.name ?? primary?.name ?? "Contato sem nome";
  const data = { name, phone: input.phone, email: input.email };

  if (primary) {
    await tx.contact.update({ where: { id: primary.id }, data });
    return;
  }
  const sameName = await tx.contact.findFirst({ where: { organizationId, accountId, name: { equals: name, mode: "insensitive" } } });
  if (sameName) {
    await tx.contact.update({ where: { id: sameName.id }, data: { ...data, isPrimary: true } });
    return;
  }
  await tx.contact.create({ data: { organizationId, accountId, isPrimary: true, ...data } });
}
