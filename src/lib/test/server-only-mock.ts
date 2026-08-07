// No-op pro pacote "server-only" dentro do Vitest — ver vitest.config.mts.
// Em produção, o bundler do Next usa o pacote real (lança erro se um módulo
// marcado "server-only" for importado de um Client Component); em teste
// puro isso não existe, então esse alias vazio evita o erro sem perder a
// proteção real do build do Next.
export {};
