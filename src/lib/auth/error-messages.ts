// O Supabase Auth sempre retorna error.message em inglês, mas o Spinos é
// 100% pt-BR — sem isso, mensagens como "Invalid login credentials"
// vazavam direto pra tela de login. Mapeia os erros mais comuns e cai num
// fallback genérico em português pra qualquer mensagem não mapeada, pra
// nunca mais vazar inglês mesmo que o Supabase mude/adicione uma mensagem.
const KNOWN_AUTH_ERRORS: Array<{ match: RegExp; message: string }> = [
  { match: /invalid login credentials/i, message: "E-mail ou senha incorretos." },
  { match: /email not confirmed/i, message: "Confirme seu e-mail antes de entrar — verifique sua caixa de entrada." },
  { match: /user already registered/i, message: 'Esse e-mail já tem uma conta. Faça login ou clique em "Esqueci minha senha".' },
  { match: /already been registered/i, message: "Esse e-mail já está em uso por outra conta." },
  { match: /password should be at least/i, message: "A senha é muito curta. Use pelo menos 6 caracteres." },
  { match: /new password should be different/i, message: "A nova senha precisa ser diferente da atual." },
  { match: /token has expired or is invalid/i, message: "Este link expirou ou já foi usado. Peça um novo." },
  { match: /email rate limit exceeded/i, message: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo." },
  { match: /email link is invalid or has expired/i, message: "Este link expirou ou já foi usado. Peça um novo." },
];

const GENERIC_FALLBACK = "Não foi possível completar essa ação. Tente novamente em instantes.";

export function translateAuthError(message: string): string {
  const known = KNOWN_AUTH_ERRORS.find((entry) => entry.match.test(message));
  return known?.message ?? GENERIC_FALLBACK;
}
