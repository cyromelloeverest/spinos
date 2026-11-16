"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { withOrgContext } from "@/lib/db/with-org-context";
import { prismaAdmin } from "@/lib/prisma-admin";
import { DEFAULT_PACK_KEY, getPack } from "@/packs/registry";
import type { NichePack } from "@/packs/schema";
import { BriefingError, buildSiteContent, subdomainLabel } from "@/lib/sites/builder";
import { hostTag } from "@/lib/sites/source";
import { platformDomain } from "@/lib/sites/env";
import { createSite, publish, regenerateFromTemplate, setIndexable, SiteExistsError, SiteInvalidError, unpublish, updateDetails } from "@/lib/sites/service";
import { logError } from "@/lib/log-error";

const BACK = "/meu-site";
const fail = (message: string): never => redirect(`${BACK}?erro=${encodeURIComponent(message)}`);
const ok = (code: string): never => redirect(`${BACK}?${code}=1`);

async function requireManager() {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  if (!organizationId || !userId) redirect("/onboarding");
  const m = await withOrgContext(organizationId!, (tx) => tx.membership.findFirst({ where: { organizationId: organizationId!, userId: userId! }, select: { role: true } }));
  if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) fail("Só donos e administradores podem mexer no site.");
  return { organizationId: organizationId!, userId: userId! };
}

// O pacote vigente do nicho da organização (o arquivo atual, não a cópia gravada na instalação,
// que pode ser anterior ao modelo de site). Sem pacote instalado, usa o geral.
async function packFor(organizationId: string): Promise<NichePack> {
  const row = await withOrgContext(organizationId, (tx) => tx.organizationPack.findUnique({ where: { organizationId }, select: { packKey: true } }));
  const pack = getPack(row?.packKey) ?? getPack(DEFAULT_PACK_KEY)!;
  if (pack.site) return pack;
  return getPack(DEFAULT_PACK_KEY)!;
}

const RESERVED = new Set(["www", "app", "api", "admin", "mail", "sites", "spinos", "suporte", "ajuda"]);

// Endereço livre entre TODAS as organizações (por isso o papel administrativo).
async function pickHostname(label: string): Promise<string> {
  const base = RESERVED.has(label) ? `${label}-site` : label;
  for (let n = 1; n < 100; n++) {
    const host = `${n === 1 ? base : `${base}-${n}`}.${platformDomain()}`;
    if (!(await prismaAdmin.siteDomain.findUnique({ where: { hostname: host }, select: { id: true } }))) return host;
  }
  throw new Error("Não foi possível achar um endereço livre");
}

function briefingFrom(f: FormData) {
  const get = (k: string) => String(f.get(k) ?? "").trim();
  // Um serviço por linha; "Título | descrição" é opcional.
  const services = get("services")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const [title, ...rest] = line.split("|");
      return { title: title.trim(), description: rest.join("|").trim() || undefined };
    });
  return {
    name: get("name"),
    city: get("city"),
    state: get("state"),
    whatsapp: get("whatsapp"),
    phone: get("phone"),
    email: get("email"),
    street: get("street"),
    responsibleName: get("responsibleName"),
    registration: get("registration"),
    instagram: get("instagram"),
    primaryColor: get("primaryColor"),
    services: services.length > 0 ? services : undefined,
  };
}

function explain(err: unknown): never {
  if (err instanceof BriefingError) return fail(err.issues.map((i) => i.message).join(" · "));
  if (err instanceof SiteExistsError) return fail("Você já tem um site.");
  if (err instanceof SiteInvalidError) return fail(`O site tem problemas e não foi publicado: ${err.problems.join("; ")}`);
  logError("sites: falha na ação", err);
  return fail("Não foi possível concluir. Tente de novo em instantes.");
}

// O cache do site público guarda cada domínio por etiqueta: limpar ao publicar, despublicar ou liberar o Google.
function purge(hostnames: string[]) {
  for (const h of hostnames) revalidateTag(hostTag(h), { expire: 0 });
}

export async function createMySite(formData: FormData) {
  const { organizationId } = await requireManager();
  const briefing = briefingFrom(formData);
  try {
    const pack = await packFor(organizationId);
    // Valida o briefing antes de reservar o endereço (o gerador lança BriefingError se faltar algo).
    buildSiteContent(pack, briefing);
    const hostname = await pickHostname(subdomainLabel(briefing.name));
    await withOrgContext(organizationId, (tx) => createSite(tx, { organizationId, pack, briefing, hostname }));
  } catch (err) {
    explain(err);
  }
  revalidatePath(BACK);
  ok("criado");
}

export async function saveMySiteDetails(siteId: string, formData: FormData) {
  const { organizationId } = await requireManager();
  try {
    const pack = await packFor(organizationId);
    await withOrgContext(organizationId, (tx) => updateDetails(tx, organizationId, siteId, pack, briefingFrom(formData)));
  } catch (err) {
    explain(err);
  }
  revalidatePath(BACK);
  ok("salvo");
}

export async function regenerateMySite(siteId: string, formData: FormData) {
  const { organizationId } = await requireManager();
  try {
    const pack = await packFor(organizationId);
    await withOrgContext(organizationId, (tx) => regenerateFromTemplate(tx, organizationId, siteId, pack, briefingFrom(formData)));
  } catch (err) {
    explain(err);
  }
  revalidatePath(BACK);
  ok("refeito");
}

export async function publishMySite(siteId: string) {
  const { organizationId, userId } = await requireManager();
  try {
    const { hostnames } = await withOrgContext(organizationId, (tx) => publish(tx, { organizationId, userId, siteId }));
    purge(hostnames);
  } catch (err) {
    explain(err);
  }
  revalidatePath(BACK);
  ok("publicado");
}

export async function unpublishMySite(siteId: string) {
  const { organizationId } = await requireManager();
  try {
    const { hostnames } = await withOrgContext(organizationId, (tx) => unpublish(tx, organizationId, siteId));
    purge(hostnames);
  } catch (err) {
    explain(err);
  }
  revalidatePath(BACK);
  ok("despublicado");
}

export async function setMySiteIndexable(siteId: string, indexable: boolean) {
  const { organizationId } = await requireManager();
  try {
    const { hostnames } = await withOrgContext(organizationId, (tx) => setIndexable(tx, organizationId, siteId, indexable));
    purge(hostnames);
  } catch (err) {
    explain(err);
  }
  revalidatePath(BACK);
  ok(indexable ? "google" : "semgoogle");
}
