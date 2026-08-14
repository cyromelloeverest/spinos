"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prismaAdmin } from "@/lib/prisma-admin";
import { withOrgContext } from "@/lib/db/with-org-context";
import { splitList } from "@/lib/form-utils";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { newTrialEndsAt } from "@/lib/trial";
import { logError } from "@/lib/log-error";
import { optionalIntSchema, optionalTextSchema, optionalUrlSchema, boundedListSchema, firstIssueMessage } from "@/lib/validation";

const organizationSchema = z.object({
  name: z.string().trim().min(1, "Nome da empresa é obrigatório.").max(200, "Nome muito longo."),
  site: optionalUrlSchema,
  city: optionalTextSchema("Cidade", 100),
  state: optionalTextSchema("Estado", 100),
  segment: optionalTextSchema("Segmento", 150),
  employeeRange: optionalTextSchema("Faixa de funcionários", 50),
  revenueRange: optionalTextSchema("Faixa de faturamento", 50),
});

// prismaAdmin de propósito: cria a organização E a primeira membership —
// não existe "contexto de org" antes desse momento, é exatamente o que
// está sendo criado aqui.
export async function createOrganization(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const result = organizationSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    site: String(formData.get("site") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    segment: String(formData.get("segment") ?? ""),
    employeeRange: String(formData.get("employeeRange") ?? ""),
    revenueRange: String(formData.get("revenueRange") ?? ""),
  });
  if (!result.success) {
    redirect(`/onboarding?error=${encodeURIComponent(firstIssueMessage(result.error))}`);
  }
  const data = result.data;

  try {
    await prismaAdmin.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { ...data, trialEndsAt: newTrialEndsAt() },
      });
      await tx.membership.create({
        data: { userId, organizationId: organization.id, role: "OWNER" },
      });
    });
  } catch (err) {
    logError("onboarding: falha ao criar organização/membership", err, { userId });
    redirect("/onboarding?dbError=1");
  }

  redirect("/onboarding/icp");
}

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
});

export async function createICP(formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    redirect("/onboarding");
  }

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
  });
  if (!result.success) {
    redirect(`/onboarding/icp?error=${encodeURIComponent(firstIssueMessage(result.error))}`);
  }
  const data = result.data;

  try {
    await withOrgContext(organizationId, (tx) =>
      tx.iCP.create({
        data: {
          organizationId,
          ...data,
          saleModel: saleModelRaw === "PONTUAL" || saleModelRaw === "RECORRENTE" ? saleModelRaw : null,
        },
      }),
    );
  } catch (err) {
    logError("onboarding: falha ao criar ICP", err, { organizationId });
    redirect("/onboarding/icp?dbError=1");
  }

  redirect("/");
}
