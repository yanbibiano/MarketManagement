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

-- Garante que não existam duas lojas com o mesmo nome (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS stores_name_lower_idx ON stores (lower(name));
