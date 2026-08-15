"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prismaAdmin } from "@/lib/prisma-admin";
import { withOrgContext } from "@/lib/db/with-org-context";
import { splitList } from "@/lib/form-utils";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { optionalIntSchema, optionalTextSchema, optionalUrlSchema, boundedListSchema, firstIssueMessage } from "@/lib/validation";
import type { SignalCategory } from "@/generated/prisma/enums";

const icpSchema = z.object({
  segments: boundedListSchema("Segmentos-alvo", 30),
  employeeMin: optionalIntSchema("Funcionários — mínimo", 0, 10_000_000),
  employeeMax: optionalIntSchema("Funcionários — máximo", 0, 10_000_000),
  states: boundedListSchema("Estados", 30, 60),
  cities: boundedListSchema("Cidades prioritárias", 60, 100),
  decisionMakerTitles: boundedListSchema("Cargo do decisor", 30, 100),
  technologies: boundedListSchema("Tecnologias", 60, 100),
  keywords: boundedListSchema("Palavras-chave", 60, 100),
  productsSold: boundedListSchema("Produtos vendidos", 60, 150),
  servicesSold: boundedListSchema("Serviços vendidos", 60, 150),
  radiusKm: optionalIntSchema("Raio de atuação", 0, 20_000),
  averageTicketBRL: optionalIntSchema("Ticket médio", 0, 1_000_000_000),
  salesCycleLength: optionalTextSchema("Ciclo de vendas", 100),
  idealCustomerDescription: optionalTextSchema("Descrição do cliente ideal", 2000),
  companiesToAvoid: boundedListSchema("Empresas a evitar", 100, 150),
});

export async function updateICP(icpId: string, formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const saleModelRaw = String(formData.get("saleModel") ?? "");

  const result = icpSchema.safeParse({
    segments: splitList(formData.get("segments")),
    employeeMin: String(formData.get("employeeMin") ?? ""),
    employeeMax: String(formData.get("employeeMax") ?? ""),
    states: splitList(formData.get("states")),
    cities: splitList(formData.get("cities")),
    decisionMakerTitles: splitList(formData.get("decisionMakerTitles")),
    technologies: splitList(formData.get("technologies")),
    keywords: splitList(formData.get("keywords")),
    productsSold: splitList(formData.get("productsSold")),
    servicesSold: splitList(formData.get("servicesSold")),
    radiusKm: String(formData.get("radiusKm") ?? ""),
    averageTicketBRL: String(formData.get("averageTicketBRL") ?? ""),
    salesCycleLength: String(formData.get("salesCycleLength") ?? ""),
    idealCustomerDescription: String(formData.get("idealCustomerDescription") ?? ""),
    companiesToAvoid: splitList(formData.get("companiesToAvoid")),
  });
  if (!result.success) {
    redirect(`/settings/icp?error=${encodeURIComponent(firstIssueMessage(result.error))}`);
  }
  const data = result.data;

  await withOrgContext(organizationId, (tx) =>
    tx.iCP.update({
      where: { id: icpId, organizationId },
      data: {
        ...data,
        saleModel: saleModelRaw === "PONTUAL" || saleModelRaw === "RECORRENTE" ? saleModelRaw : null,
        preferredSignalCategories: formData.getAll("preferredSignalCategories").map(String) as SignalCategory[],
      },
    }),
  );

  revalidatePath("/settings/icp");
  redirect("/settings/icp?saved=1");
}

const organizationProfileSchema = z.object({
  name: z.string().trim().min(1, "Nome da empresa é obrigatório.").max(200, "Nome muito longo."),
  site: optionalUrlSchema,
  city: optionalTextSchema("Cidade", 100),
  state: optionalTextSchema("Estado", 100),
  segment: optionalTextSchema("Segmento", 150),
  employeeRange: optionalTextSchema("Faixa de funcionários", 50),
  revenueRange: optionalTextSchema("Faixa de faturamento", 50),
  cnpj: optionalTextSchema("CNPJ", 30),
  phone: optionalTextSchema("Telefone", 30),
});

export async function updateOrganizationProfile(formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const result = organizationProfileSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    site: String(formData.get("site") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    segment: String(formData.get("segment") ?? ""),
    employeeRange: String(formData.get("employeeRange") ?? ""),
    revenueRange: String(formData.get("revenueRange") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!result.success) {
    redirect(`/settings/empresa?error=${encodeURIComponent(firstIssueMessage(result.error))}`);
  }
  const data = result.data;

  await withOrgContext(organizationId, (tx) =>
    tx.organization.update({
      where: { id: organizationId },
      data,
    }),
  );

  revalidatePath("/settings/empresa");
  redirect("/settings/empresa?saved=1");
}

// Toggle isolado do form de perfil de propósito — um checkbox simples não
// precisa da validação/schema do resto da página, e assim o usuário não
// precisa reenviar todo o formulário de empresa só pra ligar/desligar isso.
export async function toggleLifecycleEmails(formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  // Checkbox só manda o campo quando marcado — marcado = "quero receber",
  // então a ausência do campo é que vira opt-out=true.
  const receiveEmails = formData.get("receiveLifecycleEmails") === "on";
  const optOut = !receiveEmails;

  await withOrgContext(organizationId, (tx) =>
    tx.organization.update({
      where: { id: organizationId },
      data: { lifecycleEmailsOptOut: optOut },
    }),
  );

  revalidatePath("/settings/empresa");
  redirect("/settings/empresa?saved=1");
}

const userProfileSchema = z.object({
  name: optionalTextSchema("Nome", 150),
  role: optionalTextSchema("Cargo", 100),
  phone: optionalTextSchema("Telefone", 30),
});

// prismaAdmin de propósito: essa action só edita o próprio User pelo id, sem
// carregar organizationId nenhum — sob a policy de "users" (que exige
// contexto de org setado), precisaria de um lookup extra só pra achar uma
// org, sem ganho real, já que essa escrita não é dado de tenant.
export async function updateUserProfile(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const result = userProfileSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!result.success) {
    redirect(`/settings/empresa?error=${encodeURIComponent(firstIssueMessage(result.error))}`);
  }
  const data = result.data;

  await prismaAdmin.user.update({
    where: { id: userId },
    data,
  });

  revalidatePath("/settings/empresa");
  redirect("/settings/empresa?saved=1");
}
