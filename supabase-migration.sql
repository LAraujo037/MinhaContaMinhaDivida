-- ════════════════════════════════════════════════════════════
--  FinançasPro — Migração Supabase
--  Execute este SQL no SQL Editor do Supabase (Project → SQL Editor)
-- ════════════════════════════════════════════════════════════

-- Tabela única de dados compartilhados entre os usuários autorizados
-- Usa JSONB para máxima flexibilidade — toda a estrutura financeira fica
-- em um único registro com id='shared'.
--
-- ⚠️ Vantagens:
--   - Sincronização automática entre os 2 usuários
--   - Schema flexível: pode evoluir sem migrações
--   - Realtime do Supabase notifica mudanças em tempo real
--
-- ⚠️ Limitações:
--   - Adequado para uso pessoal (poucas centenas de transações/mês)
--   - Para volumes maiores, considerar dividir em tabelas relacionais

CREATE TABLE IF NOT EXISTS appdata (
  id           TEXT PRIMARY KEY,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   TEXT
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
-- Apenas usuários autenticados podem ler/escrever.
-- A whitelist de e-mails é validada no frontend (CONFIG.ALLOWED_EMAILS).

ALTER TABLE appdata ENABLE ROW LEVEL SECURITY;

-- Política: qualquer usuário autenticado pode ler
CREATE POLICY "Authenticated users can read appdata"
  ON appdata FOR SELECT
  TO authenticated
  USING (true);

-- Política: qualquer usuário autenticado pode inserir/atualizar
CREATE POLICY "Authenticated users can write appdata"
  ON appdata FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── REALTIME ────────────────────────────────────────────────
-- Habilita Realtime na tabela para sincronização entre dispositivos
-- (Em Database → Replication, marque a tabela 'appdata' como ativa)

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_appdata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.email();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appdata_update_timestamp ON appdata;
CREATE TRIGGER appdata_update_timestamp
  BEFORE INSERT OR UPDATE ON appdata
  FOR EACH ROW EXECUTE FUNCTION update_appdata_timestamp();

-- ════════════════════════════════════════════════════════════
--  PRÓXIMOS PASSOS:
--  1. Vá em Authentication → Users → Add user
--     - Crie os 2 usuários autorizados (manualmente)
--  2. No painel: Database → Replication → habilite a tabela 'appdata'
--     para sincronização em tempo real
--  3. Ajuste js/config.js com seus dados (URL, anon key, e-mails)
-- ════════════════════════════════════════════════════════════
