"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isCurrentUserSuperAdmin } from "@/lib/auth/current-org";
import type { Plan } from "@/generated/prisma/enums";

async function requireSuperAdmin() {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) redirect("/");
}

export async function updateOrganizationPlan(organizationId: string, formData: FormData) {
  await requireSuperAdmin();

  const plan = String(formData.get("plan") ?? "STARTER");

  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan: plan as Plan },
  });

  revalidatePath("/admin");
}
