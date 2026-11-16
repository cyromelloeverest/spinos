/**
 * Spam filter for the sites' lead forms. Contact-form spam today comes from
 * services that fill forms in real browsers (so a honeypot alone does not stop
 * it): cold outreach in English to "the website owner", SEO and backlink
 * offers, links, made-up phone numbers. Each signal adds points; two or more
 * points mark the lead as spam. Spam is kept (quarantined), never dropped, so
 * a false positive can still be recovered in the panel.
 */

export type SpamInput = {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  /** Page the form was sent from; English is expected under /en. */
  page?: string | null;
  /** Time between the page opening and the submit; null when the browser did not report it (no JavaScript or a direct post). */
  elapsedMs?: number | null;
};

export type SpamVerdict = { spam: boolean; score: number; reasons: string[] };

const EN = new Set("the and you your is are to of for with this that it my we our i i'm i’m me be have can will would just about if not on in at".split(" "));
const PT = new Set("de que o a e do da para com um uma não você meu minha nosso nossa por no na os as em é eu gostaria preciso sobre".split(" "));

const PHRASES = [
  /website owner/i,
  /\bowner\b.{0,20}\b(site|website)\b/i,
  /dear .{0,40}(administrator|admin|owner|team)/i,
  // English SEO pitches only: Brazilian visitors of an agency legitimately ask about "SEO".
  /\b(backlinks?|guest posts?|link building|domain authority|first page of google|rank(ing)? (higher|on google)|seo (services|experts?|audit|agency))\b/i,
  /\b(lead generation|more leads|web traffic|targeted traffic|increase (your )?(sales|traffic))\b/i,
  /\b(crypto|bitcoin|forex|casino|loan|viagra|cialis)\b/i,
  /\b(unsubscribe|opt[- ]out|reply (with )?["“]?(stop|no)\b)/i,
  /\bwhatsapp marketing\b|\bmass (mail|message)/i,
];

// Bare domains count too, but not e-mail addresses or Brazilian (.com.br) domains.
const URL_RE = /(https?:\/\/|www\.)\S+|(?<![@\w.-])[a-z0-9-]+\.(com|net|org|io|co|xyz|info|biz|ru|top|site|online)\b(?!\.br)/gi;

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-zà-ú'’]+/g) ?? [];
}

export function spamCheck(input: SpamInput): SpamVerdict {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };
  const message = input.message ?? "";
  const all = [input.name, input.company ?? "", message].join("\n");

  // English on a Portuguese page: the typical cold-outreach template.
  if (!input.page?.startsWith("/en")) {
    const ws = words(message);
    const en = ws.filter((w) => EN.has(w)).length;
    const pt = ws.filter((w) => PT.has(w)).length;
    if (en >= 5 && en > pt * 2) add(2, "mensagem em inglês");
  }

  if (PHRASES.some((re) => re.test(all))) add(2, "texto típico de spam (oferta de SEO, tráfego ou contato ao “dono do site”)");

  const links = all.match(URL_RE)?.length ?? 0;
  if (/(https?:\/\/|www\.)/i.test(`${input.name} ${input.company ?? ""}`)) add(2, "link no nome ou na empresa");
  else if (links >= 2) add(2, "vários links na mensagem");
  else if (links === 1) add(1, "link na mensagem");

  // Brazilian numbers have 10 or 11 digits (12 or 13 with the country code).
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    const br = /^(55)?\d{10,11}$/.test(digits);
    if (!br) add(1, "telefone fora do padrão brasileiro");
  }

  if (input.elapsedMs == null) add(1, "envio sem navegador (sem JavaScript)");
  else if (input.elapsedMs < 3000) add(1, "formulário enviado em menos de 3 segundos");

  return { spam: score >= 2, score, reasons };
}
