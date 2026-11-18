import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { DEFAULT_PACK_KEY, getPack } from "@/packs/registry";
import { getOrgSite, safeDraft } from "@/lib/sites/service";
import { createMySite, publishMySite, regenerateMySite, saveMySiteDetails, setMySiteIndexable, unpublishMySite } from "@/lib/actions/sites";
import { formatBrasilia } from "@/lib/crm/dates";
import { logError } from "@/lib/log-error";

const inputCls = "rounded-[10px] border px-3 text-[13px] outline-none w-full";
const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "40px" } as const;

function Field({ name, label, defaultValue, hint, required, type = "text", placeholder }: { name: string; label: string; defaultValue?: string | null; hint?: string; required?: boolean; type?: string; placeholder?: string }) {
  return (
    <label className="grid gap-1 text-[12px]">
      <span style={{ color: "var(--fg-muted)" }}>{label}{required ? " *" : ""}</span>
      <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} className={inputCls} style={inputStyle} />
      {hint && <span style={{ color: "var(--fg-faint)" }}>{hint}</span>}
    </label>
  );
}

type Values = { name?: string; city?: string; state?: string; whatsapp?: string; phone?: string; email?: string; street?: string; responsibleName?: string; registration?: string; instagram?: string; primaryColor?: string; services?: string };

function BriefingFields({ values, requireRegistration, withServices }: { values: Values; requireRegistration: boolean; withServices: boolean }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="name" label="Nome do negócio" defaultValue={values.name} required />
        <Field name="whatsapp" label="WhatsApp" defaultValue={values.whatsapp} required placeholder="(11) 98765-4321" hint="Os botões do site abrem a conversa neste número." />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_90px]">
        <Field name="city" label="Cidade" defaultValue={values.city} required />
        <Field name="state" label="UF" defaultValue={values.state} required placeholder="SP" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="phone" label="Telefone" defaultValue={values.phone} />
        <Field name="email" label="E-mail de contato" defaultValue={values.email} type="email" />
      </div>
      <Field name="street" label="Endereço" defaultValue={values.street} placeholder="Rua, número, bairro" />
      {requireRegistration && (
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="responsibleName" label="Responsável técnico" defaultValue={values.responsibleName} required hint="Aparece no rodapé do site, como exige o código de ética da profissão." />
          <Field name="registration" label="Registro profissional" defaultValue={values.registration} required placeholder="CRC 1SP123456/O-0" />
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="instagram" label="Instagram" defaultValue={values.instagram} placeholder="@seuperfil" />
        <Field name="primaryColor" label="Cor principal" defaultValue={values.primaryColor} placeholder="#1d4ed8" hint="Opcional. Em branco usa a cor padrão do modelo." />
      </div>
      {withServices && (
        <label className="grid gap-1 text-[12px]">
          <span style={{ color: "var(--fg-muted)" }}>Seus serviços (opcional)</span>
          <textarea name="services" rows={5} defaultValue={values.services} placeholder={"Um por linha. Para descrever: Título | descrição\nEx.: Folha de pagamento | Admissões, rescisões e obrigações do mês"} className="rounded-[10px] border px-3 py-2 text-[13px] outline-none w-full" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }} />
          <span style={{ color: "var(--fg-faint)" }}>Em branco usa os serviços do modelo. Quando preenchido, substitui a lista nas páginas do site.</span>
        </label>
      )}
    </div>
  );
}

const btn = { background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" } as const;
const btnGhost = { background: "transparent", borderColor: "var(--border-strong)", color: "var(--fg)" } as const;

export default async function MeuSitePage({ searchParams }: { searchParams: Promise<{ erro?: string; criado?: string; salvo?: string; publicado?: string; despublicado?: string; refeito?: string; google?: string; semgoogle?: string }> }) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let data;
  try {
    data = await withOrgContext(organizationId, async (tx) => ({
      site: await getOrgSite(tx, organizationId),
      org: await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true, city: true, state: true, phone: true, responsibleName: true, professionalRegistration: true } }),
      packKey: (await tx.organizationPack.findUnique({ where: { organizationId }, select: { packKey: true } }))?.packKey ?? null,
      latest: await tx.siteVersion.findFirst({ where: { organizationId }, orderBy: { version: "desc" }, select: { version: true, createdAt: true } }),
    }));
  } catch (err) {
    logError("meu-site: falha ao carregar", err, { organizationId });
    return <DbSetupNotice />;
  }

  const packWithSite = getPack(data.packKey)?.site ? getPack(data.packKey)! : getPack(DEFAULT_PACK_KEY)!;
  const requireRegistration = packWithSite.site?.requireRegistration ?? false;
  const site = data.site;
  const draft = site ? safeDraft(site) : null;
  const published = Boolean(site?.publishedVersionId);
  const primary = site?.domains.find((d) => d.isPrimary) ?? site?.domains[0];
  const url = primary ? `https://${primary.hostname}` : null;
  const business = draft?.content.business;

  const alerts = (
    <>
      {params.erro && <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }} role="alert">{params.erro}</div>}
      {(params.criado || params.salvo || params.publicado || params.despublicado || params.refeito || params.google || params.semgoogle) && (
        <div className="mb-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} role="status">
          {params.criado && "Site criado como rascunho. Revise e publique quando estiver pronto."}
          {params.salvo && "Dados salvos no rascunho. Publique para atualizar o site no ar."}
          {params.refeito && "Páginas refeitas a partir do modelo. Publique para atualizar o site no ar."}
          {params.publicado && "Site publicado."}
          {params.despublicado && "Site fora do ar. O rascunho continua guardado."}
          {params.google && "O site agora pode aparecer no Google."}
          {params.semgoogle && "O site não aparece mais nas buscas."}
        </div>
      )}
    </>
  );

  if (!site) {
    return (
      <div className="pt-6 px-4 md:px-10 pb-16 max-w-[760px]">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>Meu site</h1>
        <p className="m-0 mb-6 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          Responda o básico e o Spinos monta o seu site com páginas de captação já prontas. Os contatos que chegarem pelo formulário caem direto em Leads, com a origem registrada.
        </p>
        {alerts}
        <form action={createMySite} className="rounded-[16px] border p-5 grid gap-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <BriefingFields values={{ name: data.org.name, city: data.org.city ?? "", state: data.org.state ?? "", phone: data.org.phone ?? "", responsibleName: data.org.responsibleName ?? "", registration: data.org.professionalRegistration ?? "" }} requireRegistration={requireRegistration} withServices />
          <div><button type="submit" className="text-[13px] font-semibold px-4 py-2.5 rounded-[10px] border cursor-pointer" style={btn}>Criar meu site</button></div>
        </form>
      </div>
    );
  }

  const pages = draft?.content.pages ?? [];
  const values: Values = {
    name: business?.name,
    city: business?.address?.city,
    state: business?.address?.state,
    whatsapp: business?.whatsapp?.number,
    phone: business?.phone,
    email: business?.email,
    street: business?.address?.street,
    instagram: business?.socials.instagram,
    primaryColor: draft?.content.theme.colors.primary,
    responsibleName: data.org.responsibleName ?? "",
    registration: data.org.professionalRegistration ?? "",
  };

  return (
    <div className="pt-6 px-4 md:px-10 pb-16 max-w-[1080px]">
      <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>Meu site</h1>
      <p className="m-0 mb-6 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
        Site e páginas de captação. Quem preenche o formulário vira lead no CRM, com a página e o anúncio de origem.
      </p>
      {alerts}

      <section className="rounded-[16px] border p-5 mb-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[14px] font-semibold">{published ? "No ar" : "Rascunho, fora do ar"}</div>
            {url && (
              <p className="m-0 mt-1 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
                {published ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{primary!.hostname}</a> : primary!.hostname}
                {data.latest ? ` · versão ${data.latest.version}, publicada em ${formatBrasilia(data.latest.createdAt)}` : ""}
              </p>
            )}
            {!draft && <p className="m-0 mt-1 text-[12.5px]" style={{ color: "var(--critical)" }}>O rascunho está com problemas. Use &ldquo;Refazer a partir do modelo&rdquo; abaixo.</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <form action={publishMySite.bind(null, site.id)}><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btn}>{published ? "Publicar alterações" : "Publicar"}</button></form>
            {published && <form action={unpublishMySite.bind(null, site.id)}><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btnGhost}>Tirar do ar</button></form>}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--border)" }}>
          <p className="m-0 text-[12.5px] max-w-[520px]" style={{ color: "var(--fg-muted)" }}>
            {site.indexable ? "O site pode aparecer no Google." : "O site está escondido do Google. Revise os textos e libere quando estiver pronto."}
          </p>
          <form action={setMySiteIndexable.bind(null, site.id, !site.indexable)}><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btnGhost}>{site.indexable ? "Esconder do Google" : "Liberar para o Google"}</button></form>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-[11px] uppercase font-medium mb-2" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>Páginas</h2>
        <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {pages.map((p, i) => (
            <div key={p.slug} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <span>{p.title}<span className="ml-2 text-[11.5px]" style={{ color: "var(--fg-faint)" }}>{p.landing ? "página de captação" : p.showInMenu ? "no menu" : ""}</span></span>
              {published && url ? <a href={`${url}/${p.slug}`} target="_blank" rel="noopener noreferrer" className="text-[12.5px]" style={{ color: "var(--primary)" }}>/{p.slug}</a> : <span className="text-[12.5px]" style={{ color: "var(--fg-faint)" }}>/{p.slug}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-[11px] uppercase font-medium mb-2" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>Dados do negócio</h2>
        <form action={saveMySiteDetails.bind(null, site.id)} className="rounded-[16px] border p-5 grid gap-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <BriefingFields values={values} requireRegistration={requireRegistration} withServices={false} />
          <p className="m-0 text-[12px]" style={{ color: "var(--fg-faint)" }}>Salvar atualiza nome, contatos, endereço e cor sem mexer nos textos das páginas.</p>
          <div><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btn}>Salvar dados</button></div>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="text-[11px] uppercase font-medium mb-2" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>Refazer a partir do modelo</h2>
        <details className="rounded-[16px] border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <summary className="text-[12.5px] cursor-pointer font-semibold" style={{ color: "var(--primary)" }}>Descartar o rascunho e gerar as páginas de novo</summary>
          <form action={regenerateMySite.bind(null, site.id)} className="grid gap-4 mt-4">
            <p className="m-0 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>As páginas voltam ao texto padrão do modelo. O que está no ar só muda quando você publicar.</p>
            <BriefingFields values={values} requireRegistration={requireRegistration} withServices />
            <div><button type="submit" className="text-[12.5px] font-semibold px-3.5 py-2 rounded-[10px] border cursor-pointer" style={btnGhost}>Refazer páginas</button></div>
          </form>
        </details>
      </section>

      <section>
        <h2 className="text-[11px] uppercase font-medium mb-2" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>Domínio próprio</h2>
        <p className="m-0 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>Por enquanto o site fica no endereço acima. A ligação de um domínio próprio (ex.: seuescritorio.com.br) ainda não está disponível.</p>
      </section>
    </div>
  );
}
