// Link do WhatsApp a partir de um telefone digitado à mão. Números de 10 ou 11
// dígitos são brasileiros (DDD + número): ganham o 55. Qualquer outra coisa com
// pelo menos 10 dígitos é usada como veio (já deve ter o código do país).
export function toWhatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${withCountry}${query}`;
}

export function toTelUrl(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? `tel:+${digits.length <= 11 ? `55${digits}` : digits}` : null;
}
