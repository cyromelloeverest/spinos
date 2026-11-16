import type { ReactNode } from "react";
import { Container } from "@/components/sites/engine";
import type { LoadedSite } from "./source";

type Tool = { name: string; kind: "analytics" | "marketing"; purpose: string };

/** The policy's words in each language; the facts come from the site's data. */
const TEXT = {
  "pt-BR": {
    title: "Política de Privacidade",
    intro: (name: ReactNode) => <>Esta política explica como {name} trata os dados pessoais enviados por este site, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</>,
    collectT: "Quais dados coletamos",
    collect: "Os dados que você informa no formulário de contato (nome, empresa, telefone, e-mail e mensagem), a página de onde o contato foi enviado e a origem da visita (por exemplo, a campanha que trouxe você ao site). O endereço IP é guardado apenas de forma irreversível (criptografado), para prevenção de fraudes e abuso.",
    useT: "Para que usamos",
    use: "Exclusivamente para responder ao seu contato e dar continuidade ao atendimento solicitado. Não vendemos nem compartilhamos seus dados para fins de publicidade.",
    whereT: "Onde os dados ficam",
    where: "Os dados são armazenados em provedores de infraestrutura que podem estar localizados fora do Brasil, com medidas de segurança adequadas, conforme o art. 33 da LGPD.",
    statsT: "Estatísticas de acesso",
    stats: "Medimos de forma anônima as visitas, os cliques em botões de contato e a velocidade de carregamento das páginas, para melhorar o site. Essa medição não usa cookies, não guarda o seu endereço IP e não permite identificar você: cada visitante recebe um código aleatório que muda todos os dias.",
    cookiesT: "Cookies",
    cookies: "Cookies são pequenos arquivos guardados no seu navegador. Usamos armazenamento essencial para o site funcionar e para lembrar a sua escolha sobre cookies. Se você chegou por um anúncio, o código do clique (do Google ou da Meta) fica guardado durante a visita e, com a sua permissão de marketing, por até 90 dias; ele só é enviado junto com um formulário que você decidir preencher, para sabermos qual anúncio trouxe o seu contato.",
    noTools: " Este site não usa cookies de análise, de marketing ou de terceiros.",
    withConsent: "Com a sua permissão, e somente depois dela, usamos também:",
    kind: { analytics: "análise", marketing: "marketing" },
    for: "para",
    change: "Você pode aceitar, recusar ou mudar sua escolha a qualquer momento:",
    openPrefs: "Abrir preferências de cookies",
    rightsT: "Seus direitos",
    rights: "Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento",
    byEmail: "pelo e-mail",
    byChannels: " pelos canais de contato deste site",
    purposes: {
      ga4: "medir visitas e o uso das páginas, de forma agregada",
      gtm: "gerenciar as ferramentas de medição do site",
      metaPixel: "medir campanhas e exibir anúncios mais relevantes",
      rdStation: "identificar visitantes que se tornam contatos e acompanhar o relacionamento",
    },
  },
  en: {
    title: "Privacy Policy",
    intro: (name: ReactNode) => <>This policy explains how {name} handles the personal data sent through this website, in accordance with the Brazilian General Data Protection Law (Law No. 13,709/2018, LGPD).</>,
    collectT: "What data we collect",
    collect: "The data you enter in the contact form (name, company, phone, email and message), the page the contact was sent from and the origin of the visit (for example, the campaign that brought you to the site). The IP address is only stored in an irreversible (hashed) form, to prevent fraud and abuse.",
    useT: "How we use it",
    use: "Only to reply to your contact and follow up on the service you requested. We do not sell or share your data for advertising purposes.",
    whereT: "Where the data is stored",
    where: "The data is stored with infrastructure providers that may be located outside Brazil, with appropriate security measures, as allowed by article 33 of the LGPD.",
    statsT: "Visit statistics",
    stats: "We anonymously measure visits, clicks on contact buttons and page loading speed to improve the site. This measurement uses no cookies, does not store your IP address and cannot identify you: each visitor gets a random code that changes every day.",
    cookiesT: "Cookies",
    cookies: "Cookies are small files stored in your browser. We use essential storage for the site to work and to remember your cookie choice. If you arrived through an ad, the click code (from Google or Meta) is kept during your visit and, with your marketing consent, for up to 90 days; it is only sent with a form you choose to fill in, so we know which ad brought your contact.",
    noTools: " This site does not use analytics, marketing or third-party cookies.",
    withConsent: "With your permission, and only after it, we also use:",
    kind: { analytics: "analytics", marketing: "marketing" },
    for: "to",
    change: "You can accept, reject or change your choice at any time:",
    openPrefs: "Open cookie preferences",
    rightsT: "Your rights",
    rights: "You can request access to, correction or deletion of your data at any time",
    byEmail: "by email at",
    byChannels: " through this site's contact channels",
    purposes: {
      ga4: "measure visits and page usage in aggregate",
      gtm: "manage the site's measurement tools",
      metaPixel: "measure campaigns and show more relevant ads",
      rdStation: "identify visitors who become contacts and follow up on the relationship",
    },
  },
  es: {
    title: "Política de Privacidad",
    intro: (name: ReactNode) => <>Esta política explica cómo {name} trata los datos personales enviados a través de este sitio, de acuerdo con la Ley General de Protección de Datos de Brasil (Ley nº 13.709/2018, LGPD).</>,
    collectT: "Qué datos recopilamos",
    collect: "Los datos que usted indica en el formulario de contacto (nombre, empresa, teléfono, correo electrónico y mensaje), la página desde la que se envió el contacto y el origen de la visita (por ejemplo, la campaña que lo trajo al sitio). La dirección IP solo se guarda de forma irreversible (cifrada), para prevenir fraudes y abusos.",
    useT: "Para qué los usamos",
    use: "Exclusivamente para responder a su contacto y dar continuidad a la atención solicitada. No vendemos ni compartimos sus datos con fines publicitarios.",
    whereT: "Dónde se guardan los datos",
    where: "Los datos se almacenan en proveedores de infraestructura que pueden estar ubicados fuera de Brasil, con medidas de seguridad adecuadas, según el artículo 33 de la LGPD.",
    statsT: "Estadísticas de acceso",
    stats: "Medimos de forma anónima las visitas, los clics en los botones de contacto y la velocidad de carga de las páginas, para mejorar el sitio. Esta medición no usa cookies, no guarda su dirección IP y no permite identificarlo: cada visitante recibe un código aleatorio que cambia todos los días.",
    cookiesT: "Cookies",
    cookies: "Las cookies son pequeños archivos guardados en su navegador. Usamos almacenamiento esencial para que el sitio funcione y para recordar su elección sobre las cookies. Si llegó por un anuncio, el código del clic (de Google o de Meta) se guarda durante la visita y, con su permiso de marketing, hasta 90 días; solo se envía junto con un formulario que usted decida completar, para saber qué anuncio trajo su contacto.",
    noTools: " Este sitio no usa cookies de análisis, de marketing ni de terceros.",
    withConsent: "Con su permiso, y solo después de él, también usamos:",
    kind: { analytics: "análisis", marketing: "marketing" },
    for: "para",
    change: "Puede aceptar, rechazar o cambiar su elección en cualquier momento:",
    openPrefs: "Abrir preferencias de cookies",
    rightsT: "Sus derechos",
    rights: "Puede solicitar el acceso, la corrección o la eliminación de sus datos en cualquier momento",
    byEmail: "por correo electrónico a",
    byChannels: " por los canales de contacto de este sitio",
    purposes: {
      ga4: "medir las visitas y el uso de las páginas de forma agregada",
      gtm: "gestionar las herramientas de medición del sitio",
      metaPixel: "medir campañas y mostrar anuncios más relevantes",
      rdStation: "identificar a los visitantes que se convierten en contactos y dar seguimiento a la relación",
    },
  },
  ja: {
    title: "プライバシーポリシー",
    intro: (name: ReactNode) => <>このポリシーは、{name}がこのサイトを通じて受け取った個人情報を、ブラジル個人情報保護法(LGPD、法律第13.709/2018号)に従ってどのように取り扱うかを説明するものです。</>,
    collectT: "収集する情報",
    collect: "お問い合わせフォームに入力された情報(お名前、会社名、電話番号、メールアドレス、メッセージ)、送信されたページ、訪問の経路(例:サイトに来るきっかけとなったキャンペーン)です。IPアドレスは、不正や悪用を防ぐために、元に戻せない形(暗号化)でのみ保存します。",
    useT: "利用目的",
    use: "お問い合わせへの返信と、ご依頼いただいた対応を進めるためだけに利用します。お客様の情報を販売したり、広告目的で共有したりすることはありません。",
    whereT: "保存場所",
    where: "情報は、ブラジル国外にある場合もあるインフラ事業者のサーバーに、LGPD第33条に基づく適切な安全対策のもとで保存されます。",
    statsT: "アクセス統計",
    stats: "サイト改善のため、訪問数、お問い合わせボタンのクリック、ページの表示速度を匿名で計測しています。この計測ではCookieを使わず、IPアドレスも保存せず、個人を特定することはできません。訪問者には毎日変わるランダムなコードが割り当てられます。",
    cookiesT: "Cookie",
    cookies: "Cookieとは、ブラウザに保存される小さなファイルです。サイトの動作と、Cookieに関するお客様の選択を記憶するために、必要最小限の保存領域を使用しています。広告からサイトに来られた場合、クリックのコード(GoogleまたはMeta)を訪問中のみ保存し、マーケティングへの同意がある場合は最長90日間保存します。このコードは、お客様が送信を選んだフォームと一緒にのみ送られ、どの広告からお問い合わせいただいたかを知るために使われます。",
    noTools: "このサイトでは、分析用・マーケティング用・第三者のCookieは使用していません。",
    withConsent: "お客様の同意がある場合に限り、次のツールも使用します:",
    kind: { analytics: "分析", marketing: "マーケティング" },
    for: "目的:",
    change: "同意の承認・拒否・変更は、いつでも行えます:",
    openPrefs: "Cookieの設定を開く",
    rightsT: "お客様の権利",
    rights: "ご自身の情報の開示、訂正、削除は、いつでも請求できます。",
    byEmail: "ご連絡先:",
    byChannels: "このサイトのお問い合わせ窓口からご連絡ください",
    purposes: {
      ga4: "ページの訪問と利用状況を集計して計測するため",
      gtm: "サイトの計測ツールを管理するため",
      metaPixel: "キャンペーンの効果を測定し、より関連性の高い広告を表示するため",
      rdStation: "お問い合わせにつながった訪問者を把握し、その後のやり取りを続けるため",
    },
  },
};

/**
 * Default LGPD privacy notice generated from the site's data, in the page's
 * language. Every site has a lead form, so every site needs one; a client
 * with its own legal text can publish a page with slug "privacidade".
 */
export function PrivacyPolicy({ site }: { site: LoadedSite }) {
  const t = TEXT[site.locale];
  const { business, integrations } = site.content;
  const tools: Tool[] = [
    integrations.ga4 && { name: "Google Analytics", kind: "analytics" as const, purpose: t.purposes.ga4 },
    integrations.gtm && { name: "Google Tag Manager", kind: "analytics" as const, purpose: t.purposes.gtm },
    integrations.metaPixel && { name: "Meta Pixel (Facebook/Instagram)", kind: "marketing" as const, purpose: t.purposes.metaPixel },
    integrations.rdStation && { name: "RD Station Marketing", kind: "marketing" as const, purpose: t.purposes.rdStation },
  ].filter((x): x is Tool => Boolean(x));
  const h2 = "pt-4 font-heading text-2xl font-semibold";
  return (
    <Container className="max-w-3xl py-16">
      <article className="space-y-5 leading-relaxed text-muted [&_h1]:text-ink [&_h2]:text-ink">
        <h1 className="font-heading text-4xl font-bold">{t.title}</h1>
        <p>{t.intro(<strong className="text-ink">{business.name}</strong>)}</p>
        <h2 className={h2}>{t.collectT}</h2>
        <p>{t.collect}</p>
        <h2 className={h2}>{t.useT}</h2>
        <p>{t.use}</p>
        <h2 className={h2}>{t.whereT}</h2>
        <p>{t.where}</p>
        <h2 className={h2}>{t.statsT}</h2>
        <p>{t.stats}</p>
        <h2 className={h2}>{t.cookiesT}</h2>
        <p>
          {t.cookies}
          {tools.length === 0 && t.noTools}
        </p>
        {tools.length > 0 && (
          <>
            <p>{t.withConsent}</p>
            <ul className="list-disc space-y-1 pl-6">
              {tools.map((tool) => (
                <li key={tool.name}>
                  <strong className="text-ink">{tool.name}</strong> ({t.kind[tool.kind]}): {t.for} {tool.purpose}.
                </li>
              ))}
            </ul>
            <p>{t.change}</p>
            <p>
              <button type="button" data-cookie-preferences className="font-medium text-brand underline">
                {t.openPrefs}
              </button>
            </p>
          </>
        )}
        <h2 className={h2}>{t.rightsT}</h2>
        <p>
          {t.rights}
          {business.email ? (
            <>
              {" "}
              {t.byEmail} <a className="text-brand underline" href={`mailto:${business.email}`}>{business.email}</a>
            </>
          ) : (
            t.byChannels
          )}
          .
        </p>
      </article>
    </Container>
  );
}
