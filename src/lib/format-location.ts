// Cidade/estado de uma Company podem ser null quando a IA não confirmou
// isso em fonte pública real (ver NO_FABRICATION_INSTRUCTION em
// search.ts) — evita mostrar ", " ou "null" cru na tela.
export function formatLocation(city: string | null, state: string | null): string {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return "Localização não confirmada";
}
