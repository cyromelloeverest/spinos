export type OutgoingEmail = {
  from: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type EmailProvider = {
  /** Devolve o identificador do envio no provedor. Lança erro se o provedor recusou. */
  send(email: OutgoingEmail): Promise<{ id: string }>;
};

/** Nome de exibição seguro para o cabeçalho From: sem aspas, colchetes angulares nem quebras de linha. */
export function safeDisplayName(name: string): string {
  return name.replace(/["<>\r\n\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Spinos";
}

export const resendProvider: EmailProvider = {
  async send(email) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY ausente");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: email.from, to: email.to, reply_to: email.replyTo ?? undefined, subject: email.subject, html: email.html, text: email.text, headers: email.headers }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("Resend sem id");
    return { id: json.id };
  },
};
