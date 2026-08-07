-- ═══════════════════════════════════════════════════════
--  GestãoLoja — Schema do banco de dados (PostgreSQL)
-- ═══════════════════════════════════════════════════════
-- Rode este arquivo uma vez no seu banco (Supabase/Neon/etc.)
-- antes de subir o backend. No painel do Supabase: SQL Editor > New query > cole e execute.
-- No Neon: aba "SQL Editor" no console.

CREATE TABLE IF NOT EXISTS stores (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,
  boss_pass_hash TEXT, -- senha do Chefe, separada da senha de entrada da loja (NULL = loja antiga, ainda não migrada)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Guarda produtos, categorias, histórico, config e funcionários
  -- (funcionários incluem passHash, que NUNCA é enviado ao cliente pela API).
  data        JSONB NOT NULL DEFAULT '{
                 "products": [],
                 "customCats": [],
                 "saleHistory": [],
                 "config": {"lowStock": 3},
                 "employees": []
               }'::jsonb
);

-- ═══════════════════════════════════════════════════════
--  MIGRAÇÃO — rode isto se sua tabela `stores` já existe
--  (ex: você já tem lojas cadastradas em produção).
--  Se a tabela ainda não existe, o CREATE TABLE acima já
--  cria a coluna certa e este bloco não faz nada (idempotente).
-- ═══════════════════════════════════════════════════════
ALTER TABLE stores ADD COLUMN IF NOT EXISTS boss_pass_hash TEXT;

-- Garante que não existam duas lojas com o mesmo nome (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS stores_name_lower_idx ON stores (lower(name));
