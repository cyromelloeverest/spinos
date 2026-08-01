"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { splitList } from "@/lib/form-utils";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";

export async function updateICP(icpId: string, formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const employeeMinRaw = String(formData.get("employeeMin") ?? "").trim();
  const employeeMaxRaw = String(formData.get("employeeMax") ?? "").trim();
  const radiusRaw = String(formData.get("radiusKm") ?? "").trim();

  await prisma.iCP.update({
    where: { id: icpId, organizationId },
    data: {
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
    },
  });

  revalidatePath("/settings/icp");
  redirect("/settings/icp?saved=1");
}

export async function updateOrganizationProfile(formData: FormData) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome da empresa é obrigatório.");

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      name,
      site: String(formData.get("site") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      state: String(formData.get("state") ?? "").trim() || null,
      segment: String(formData.get("segment") ?? "").trim() || null,
      employeeRange: String(formData.get("employeeRange") ?? "").trim() || null,
      revenueRange: String(formData.get("revenueRange") ?? "").trim() || null,
    },
  });

  revalidatePath("/settings/empresa");
  redirect("/settings/empresa?saved=1");
}

export async function updateUserProfile(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();

  await prisma.user.update({
    where: { id: userId },
    data: { name: name || null },
  });

  revalidatePath("/settings/empresa");
  redirect("/settings/empresa?saved=1");
}
