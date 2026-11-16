import { escapeHtml } from "@/lib/html-escape";

export type RenderInput = {
  subject: string;
  preheader?: string | null;
  body: string;
  firstName?: string | null;
  senderName: string;
  /** Linha legal do remetente (CNPJ, cidade) e assinatura do segmento, já preenchidas. */
  senderLines: string[];
  unsubscribeUrl: string;
};

const firstNameOf = (name: string | null | undefined) => (name?.trim().split(/\s+/)[0] ?? "").slice(0, 40);

/** {{nome}} vira o primeiro nome; sem nome, some junto com a vírgula/espaço que o seguia ("Olá, {{nome}}!" → "Olá!"). */
export function fillName(text: string, firstName: string | null | undefined): string {
  const n = firstNameOf(firstName);
  return text.replace(/\{\{\s*nome\s*\}\}/gi, n).replace(/,\s*(?=[!.?:]|$)/g, "").replace(/[ \t]{2,}/g, " ").replace(/\s+([!.?:,])/g, "$1");
}

/** Texto simples → HTML seguro: parágrafos por linha em branco, quebras simples preservadas, nada de HTML do autor. */
export function renderCampaignHtml(input: RenderInput): string {
  const text = fillName(input.body, input.firstName);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const pre = input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>` : "";
  const lines = input.senderLines.filter(Boolean).map((l) => escapeHtml(l)).join("<br>");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.subject)}</title></head><body style="margin:0;background:#f3f4f6;"><div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;">${pre}<div style="background:#ffffff;border-radius:8px;padding:28px;">${paragraphs}</div><div style="padding:16px 4px;font-size:12px;line-height:1.6;color:#6b7280;">${lines ? `${lines}<br><br>` : ""}Você recebe este e-mail de ${escapeHtml(input.senderName)} porque informou seus dados e autorizou o contato, ou porque é cliente.<br><a href="${input.unsubscribeUrl}" style="color:#6b7280;">Não quero mais receber estes e-mails</a></div></div></body></html>`;
}

export function renderCampaignText(input: RenderInput): string {
  const lines = input.senderLines.filter(Boolean).join("\n");
  return `${fillName(input.body, input.firstName).trim()}\n\n--\n${lines ? `${lines}\n` : ""}Para não receber mais: ${input.unsubscribeUrl}`;
}
