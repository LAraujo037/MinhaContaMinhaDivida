-- ════════════════════════════════════════════════════════════
--  MIGRAÇÃO SUPABASE — Sistema de Gestão Financeira Pessoal
--  Execute este SQL no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- ── CONTAS A PAGAR ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  categoria TEXT DEFAULT 'Outros',
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago')),
  data_pagamento DATE,
  observacoes TEXT DEFAULT '',
  conta_fixa_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONTAS FIXAS (RECORRENTES) ──────────────────────────────
CREATE TABLE IF NOT EXISTS contas_fixas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  categoria TEXT DEFAULT 'Outros',
  observacoes TEXT DEFAULT '',
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK de contas para contas_fixas
ALTER TABLE contas
  ADD CONSTRAINT fk_conta_fixa
  FOREIGN KEY (conta_fixa_id) REFERENCES contas_fixas(id)
  ON DELETE SET NULL;

-- ── CARTÕES DE CRÉDITO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cartoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  limite DECIMAL(10,2) NOT NULL DEFAULT 0,
  dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── COMPRAS NO CARTÃO ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras_cartao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cartao_id UUID NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  total_parcelas INTEGER DEFAULT 1,
  data_compra DATE NOT NULL,
  data_primeira_parcela DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PARCELAS DO CARTÃO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelas_cartao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES compras_cartao(id) ON DELETE CASCADE,
  cartao_id UUID NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  paga BOOLEAN DEFAULT false,
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── EMPRÉSTIMOS / FINANCIAMENTOS ────────────────────────────
CREATE TABLE IF NOT EXISTS emprestimos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  valor_total DECIMAL(10,2) DEFAULT 0,
  total_parcelas INTEGER NOT NULL,
  valor_parcela DECIMAL(10,2) NOT NULL,
  taxa_juros DECIMAL(5,2),
  data_primeira_parcela DATE NOT NULL,
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PARCELAS DOS EMPRÉSTIMOS ────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelas_emprestimo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  emprestimo_id UUID NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  paga BOOLEAN DEFAULT false,
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── VR — SALDO ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vr_saldo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  saldo DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── VR — TRANSAÇÕES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vr_transacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('credito','debito')),
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT DEFAULT '',
  saldo_apos DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
--  Ativa RLS em todas as tabelas para segurança
-- ════════════════════════════════════════════════════════════

ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_fixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_cartao ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_cartao ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_emprestimo ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_saldo ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_transacoes ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas usuários autenticados podem acessar
-- (o controle de e-mail é feito no frontend, mas o RLS garante que só logados acessam)

CREATE POLICY "Autenticados podem ver contas" ON contas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem ver contas_fixas" ON contas_fixas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem ver cartoes" ON cartoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem ver compras_cartao" ON compras_cartao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem ver parcelas_cartao" ON parcelas_cartao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem ver emprestimos" ON emprestimos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem ver parcelas_emprestimo" ON parcelas_emprestimo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem ver vr_saldo" ON vr_saldo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem ver vr_transacoes" ON vr_transacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
--  ÍNDICES para melhor performance
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON contas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_status ON contas(status);
CREATE INDEX IF NOT EXISTS idx_parcelas_cartao_data ON parcelas_cartao(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_cartao_cartao ON parcelas_cartao(cartao_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_emp_id ON parcelas_emprestimo(emprestimo_id);
