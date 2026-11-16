import type { ReactNode } from "react";
import { Container } from "@/components/sites/engine";
import type { LoadedSite } from "./source";

type Copy = {
  title: string;
  intro: (name: ReactNode) => ReactNode;
  sections: { title: string; body: (name: ReactNode, privacy: ReactNode) => ReactNode }[];
  lawT: string;
  law: string;
  venue: (place: string) => string;
  contactT: string;
  contact: string;
  byEmail: string;
  byChannels: string;
  privacy: string;
};

/** The terms' words in each language; the facts (name, city, e-mail) come from the site's data. */
const TEXT: Record<LoadedSite["locale"], Copy> = {
  "pt-BR": {
    title: "Termos de Uso",
    intro: (name) => <>Estes termos regulam o uso deste site, mantido por {name}. Ao navegar por ele, você concorda com as condições abaixo.</>,
    sections: [
      { title: "Conteúdo do site", body: () => "As informações publicadas têm caráter informativo e podem ser atualizadas a qualquer momento. Condições, prazos e valores de produtos ou serviços são confirmados no atendimento." },
      { title: "Propriedade intelectual", body: (name) => <>Textos, imagens, vídeos, marcas e demais conteúdos deste site pertencem a {name} ou a seus licenciantes. A reprodução, total ou parcial, depende de autorização prévia, exceto o compartilhamento de links para as páginas.</> },
      { title: "Uso permitido", body: () => "Você se compromete a usar o site de forma lícita: não tentar acessar áreas restritas, interferir no funcionamento do site ou enviar pelos formulários dados de outras pessoas sem autorização delas." },
      { title: "Links externos", body: () => "O site pode conter links para sites de terceiros, como redes sociais e parceiros. Esses sites têm termos e políticas próprios, pelos quais não respondemos." },
      { title: "Privacidade", body: (_name, privacy) => <>O tratamento dos dados pessoais enviados por este site está descrito na {privacy}.</> },
      { title: "Disponibilidade", body: () => "Buscamos manter o site disponível e as informações corretas, mas não garantimos funcionamento ininterrupto nem ausência de erros. O site pode ficar fora do ar para manutenção." },
      { title: "Alterações destes termos", body: () => "Estes termos podem ser atualizados a qualquer momento. A versão válida é sempre a publicada nesta página." },
    ],
    lawT: "Legislação aplicável",
    law: "Estes termos são regidos pelas leis brasileiras, incluindo o Código de Defesa do Consumidor e o Marco Civil da Internet (Lei nº 12.965/2014).",
    venue: (place) => ` Fica eleito o foro da comarca de ${place}, ressalvado o direito do consumidor de propor ação no foro do seu domicílio.`,
    contactT: "Contato",
    contact: "Dúvidas sobre estes termos podem ser enviadas",
    byEmail: "pelo e-mail",
    byChannels: "pelos canais de contato deste site",
    privacy: "Política de Privacidade",
  },
  en: {
    title: "Terms of Use",
    intro: (name) => <>These terms govern the use of this website, run by {name}. By browsing it, you agree to the conditions below.</>,
    sections: [
      { title: "Website content", body: () => "The information published here is for general information and may be updated at any time. Conditions, deadlines and prices of products or services are confirmed when you contact us." },
      { title: "Intellectual property", body: (name) => <>Texts, images, videos, trademarks and other content on this website belong to {name} or its licensors. Reproducing them, in whole or in part, requires prior permission, except for sharing links to the pages.</> },
      { title: "Acceptable use", body: () => "You agree to use the website lawfully: not to try to access restricted areas, interfere with how the website works or submit other people's data through the forms without their permission." },
      { title: "External links", body: () => "The website may link to third-party sites, such as social networks and partners. Those sites have their own terms and policies, for which we are not responsible." },
      { title: "Privacy", body: (_name, privacy) => <>How the personal data sent through this website is handled is described in the {privacy}.</> },
      { title: "Availability", body: () => "We try to keep the website available and its information accurate, but we do not guarantee uninterrupted operation or the absence of errors. The website may be offline for maintenance." },
      { title: "Changes to these terms", body: () => "These terms may be updated at any time. The valid version is always the one published on this page." },
    ],
    lawT: "Governing law",
    law: "These terms are governed by Brazilian law, including the Consumer Protection Code and the Brazilian Internet Civil Framework (Law No. 12,965/2014).",
    venue: (place) => ` The courts of ${place} are chosen to settle any dispute, without prejudice to the consumer's right to sue in their own place of residence.`,
    contactT: "Contact",
    contact: "Questions about these terms can be sent",
    byEmail: "by email to",
    byChannels: "through this website's contact channels",
    privacy: "Privacy Policy",
  },
  es: {
    title: "Términos de Uso",
    intro: (name) => <>Estos términos regulan el uso de este sitio, mantenido por {name}. Al navegar por él, usted acepta las condiciones a continuación.</>,
    sections: [
      { title: "Contenido del sitio", body: () => "La información publicada tiene carácter informativo y puede actualizarse en cualquier momento. Las condiciones, plazos y precios de productos o servicios se confirman en la atención." },
      { title: "Propiedad intelectual", body: (name) => <>Los textos, imágenes, videos, marcas y demás contenidos de este sitio pertenecen a {name} o a sus licenciantes. Su reproducción, total o parcial, requiere autorización previa, salvo compartir enlaces a las páginas.</> },
      { title: "Uso permitido", body: () => "Usted se compromete a usar el sitio de forma lícita: no intentar acceder a áreas restringidas, interferir en el funcionamiento del sitio ni enviar por los formularios datos de otras personas sin su autorización." },
      { title: "Enlaces externos", body: () => "El sitio puede contener enlaces a sitios de terceros, como redes sociales y socios. Esos sitios tienen términos y políticas propios, de los cuales no somos responsables." },
      { title: "Privacidad", body: (_name, privacy) => <>El tratamiento de los datos personales enviados por este sitio se describe en la {privacy}.</> },
      { title: "Disponibilidad", body: () => "Procuramos mantener el sitio disponible y la información correcta, pero no garantizamos un funcionamiento ininterrumpido ni la ausencia de errores. El sitio puede quedar fuera de línea por mantenimiento." },
      { title: "Cambios en estos términos", body: () => "Estos términos pueden actualizarse en cualquier momento. La versión válida es siempre la publicada en esta página." },
    ],
    lawT: "Legislación aplicable",
    law: "Estos términos se rigen por las leyes de Brasil, incluido el Código de Defensa del Consumidor y el Marco Civil de Internet (Ley nº 12.965/2014).",
    venue: (place) => ` Se elige el foro de la comarca de ${place}, sin perjuicio del derecho del consumidor de demandar en el foro de su domicilio.`,
    contactT: "Contacto",
    contact: "Las dudas sobre estos términos pueden enviarse",
    byEmail: "por correo electrónico a",
    byChannels: "por los canales de contacto de este sitio",
    privacy: "Política de Privacidad",
  },
  ja: {
    title: "利用規約",
    intro: (name) => <>この規約は、{name}が運営するこのサイトの利用条件を定めるものです。サイトを閲覧することで、以下の条件に同意したものとみなされます。</>,
    sections: [
      { title: "サイトの内容", body: () => "掲載している情報は一般的な案内を目的としたもので、予告なく更新されることがあります。商品やサービスの条件、納期、価格は、お問い合わせの際に確認いたします。" },
      { title: "知的財産", body: (name) => <>このサイトの文章、画像、動画、商標その他のコンテンツは、{name}またはそのライセンス提供者に帰属します。ページへのリンクの共有を除き、全部または一部の複製には事前の許可が必要です。</> },
      { title: "禁止事項", body: () => "サイトは適法に利用してください。制限された領域へのアクセスの試み、サイトの動作の妨害、本人の許可なく他人の情報をフォームから送信することは禁止します。" },
      { title: "外部リンク", body: () => "このサイトには、SNSや提携先など第三者のサイトへのリンクが含まれる場合があります。それらのサイトには独自の規約とポリシーがあり、当方は責任を負いません。" },
      { title: "プライバシー", body: (_name, privacy) => <>このサイトを通じて送信された個人情報の取り扱いは、{privacy}に記載しています。</> },
      { title: "サイトの提供", body: () => "サイトを利用可能な状態に保ち、情報を正確に保つよう努めていますが、中断のない動作や誤りがないことを保証するものではありません。メンテナンスのためにサイトを停止することがあります。" },
      { title: "規約の変更", body: () => "この規約は随時更新されることがあります。有効なのは、常にこのページに掲載されている版です。" },
    ],
    lawT: "準拠法",
    law: "この規約は、消費者保護法およびインターネット民事基本法(法律第12.965/2014号)を含むブラジルの法律に準拠します。",
    venue: (place) => `紛争については${place}の裁判所を管轄裁判所とします。ただし、消費者が自身の住所地の裁判所に訴えを提起する権利は妨げられません。`,
    contactT: "お問い合わせ",
    contact: "この規約に関するご質問は、",
    byEmail: "次のメールアドレスまでお寄せください:",
    byChannels: "このサイトのお問い合わせ窓口からお寄せください",
    privacy: "プライバシーポリシー",
  },
};

/**
 * Default terms of use generated from the site's data, in the page's language.
 * Generic on purpose (no promise about the client's business); a client with its
 * own legal text can publish a page with slug "termos-de-uso", which wins.
 */
export function TermsOfUse({ site }: { site: LoadedSite }) {
  const t = TEXT[site.locale];
  const { business } = site.content;
  const name = <strong className="text-ink">{business.name}</strong>;
  const privacy = <a className="text-brand underline" href={`${site.basePath}/privacidade`}>{t.privacy}</a>;
  const place = business.address ? `${business.address.city}/${business.address.state}` : null;
  const h2 = "pt-4 font-heading text-2xl font-semibold";
  const ja = site.locale === "ja";
  return (
    <Container className="max-w-3xl py-16">
      <article className="space-y-5 leading-relaxed text-muted [&_h1]:text-ink [&_h2]:text-ink">
        <h1 className="font-heading text-4xl font-bold">{t.title}</h1>
        <p>{t.intro(name)}</p>
        {t.sections.map((s) => (
          <section key={s.title} className="space-y-3">
            <h2 className={h2}>{s.title}</h2>
            <p>{s.body(name, privacy)}</p>
          </section>
        ))}
        <h2 className={h2}>{t.lawT}</h2>
        <p>
          {t.law}
          {place && t.venue(place)}
        </p>
        <h2 className={h2}>{t.contactT}</h2>
        <p>
          {t.contact}
          {ja ? "" : " "}
          {business.email ? (
            <>
              {t.byEmail} <a className="text-brand underline" href={`mailto:${business.email}`}>{business.email}</a>
              {ja ? "" : "."}
            </>
          ) : (
            <>
              {t.byChannels}
              {ja ? "。" : "."}
            </>
          )}
        </p>
      </article>
    </Container>
  );
}
