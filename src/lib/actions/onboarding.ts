"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { splitList } from "@/lib/form-utils";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { newTrialEndsAt } from "@/lib/trial";
import { logError } from "@/lib/log-error";

export async function createOrganization(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const site = String(formData.get("site") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const segment = String(formData.get("segment") ?? "").trim() || null;
  const employeeRange = String(formData.get("employeeRange") ?? "").trim() || null;
  const revenueRange = String(formData.get("revenueRange") ?? "").trim() || null;

  if (!name) {
    throw new Error("Nome da empresa é obrigatório.");
  }

  try {
    const organization = await prisma.organization.create({
      data: { name, site, city, state, segment, employeeRange, revenueRange, trialEndsAt: newTrialEndsAt() },
    });
    await prisma.membership.create({
      data: { userId, organizationId: organization.id, role: "OWNER" },
    });
  } catch (err) {
    logError("onboarding: falha ao criar organização/membership", err, { userId });
    redirect("/onboarding?dbError=1");
  }

  redirect("/onboarding/icp");
}

export async function createICP(formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    redirect("/onboarding");
  }

  const employeeMinRaw = String(formData.get("employeeMin") ?? "").trim();
  const employeeMaxRaw = String(formData.get("employeeMax") ?? "").trim();
  const radiusRaw = String(formData.get("radiusKm") ?? "").trim();
  const ticketRaw = String(formData.get("averageTicketBRL") ?? "").trim();
  const saleModelRaw = String(formData.get("saleModel") ?? "");

  try {
    await prisma.iCP.create({
      data: {
        organizationId,
        segments: splitList(formData.get("segments")),
        employeeMin: employeeMinRaw ? Number(employeeMinRaw) : null,
        employeeMax: employeeMaxRaw ? Number(employeeMaxRaw) : null,
        states: splitList(formData.get("states")),
        cities: splitList(formData.get("cities")),
        decisionMakerTitles: splitList(formData.get("decisionMakerTitles")),
        technologies: splitList(formData.get("technologies")),
        keywords: splitList(formData.get("keywords")),
        productsSold: splitList(formData.get("productsSold")),
        servicesSold: splitList(formData.get("servicesSold")),
        radiusKm: radiusRaw ? Number(radiusRaw) : null,
        averageTicketBRL: ticketRaw ? Number(ticketRaw) : null,
        salesCycleLength: String(formData.get("salesCycleLength") ?? "").trim() || null,
        saleModel: saleModelRaw === "PONTUAL" || saleModelRaw === "RECORRENTE" ? saleModelRaw : null,
      },
    });
  } catch (err) {
    logError("onboarding: falha ao criar ICP", err, { organizationId });
    redirect("/onboarding/icp?dbError=1");
  }

  redirect("/");
}
