import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com a chave SECRETA do Supabase — acesso total ao Storage, ignora
// qualquer policy. Só roda no servidor (server-only) e só deve ser usado
// DEPOIS de a action ter checado sessão, acesso ao módulo e pertencimento da
// organização. Nunca repassar esse cliente nem a chave pro navegador.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY não configurada.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const LICITACOES_BUCKET = "licitacoes";
