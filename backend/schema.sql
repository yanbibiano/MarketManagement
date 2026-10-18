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

-- ═══════════════════════════════════════════════════════
--  BACKUPS AUTOMÁTICOS — snapshot periódico dos dados de
--  cada loja, independente do backup de 7 dias do Supabase.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS store_backups (
  id         BIGSERIAL PRIMARY KEY,
  store_id   TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Acelera "listar backups de uma loja, mais recentes primeiro"
CREATE INDEX IF NOT EXISTS store_backups_store_id_created_idx
  ON store_backups (store_id, created_at DESC);

-- Garante que não existam duas lojas com o mesmo nome (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS stores_name_lower_idx ON stores (lower(name));
