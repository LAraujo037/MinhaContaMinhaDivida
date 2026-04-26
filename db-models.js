// ════════════════════════════════════════════════════════════
//  db-models.js — Todas as operações de banco de dados
// ════════════════════════════════════════════════════════════

function ultimoDiaMes(ano, mes) {
  return new Date(parseInt(ano), parseInt(mes), 0).getDate();
}

const DB = {

  // ── CONTAS A PAGAR ──────────────────────────────────────
  contas: {
    async list(filters = {}) {
      let q = db.from('contas').select('*').order('data_vencimento', { ascending: true });
      if (filters.mes) {
        const [ano, mes] = filters.mes.split('-');
        const inicio = `${ano}-${mes}-01`;
        const fim = `${ano}-${mes}-${ultimoDiaMes(ano, mes)}`;
        q = q.gte('data_vencimento', inicio).lte('data_vencimento', fim);
      }
      if (filters.status && filters.status !== 'todos') {
        if (filters.status === 'atrasado') {
          const hoje = new Date().toISOString().split('T')[0];
          q = q.eq('status', 'pendente').lt('data_vencimento', hoje);
        } else {
          q = q.eq('status', filters.status);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async create(conta) {
      const { data, error } = await db.from('contas').insert([conta]).select();
      if (error) throw error;
      return data[0];
    },

    async update(id, updates) {
      const { data, error } = await db.from('contas').update(updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },

    async delete(id) {
      const { error } = await db.from('contas').delete().eq('id', id);
      if (error) throw error;
    },

    async marcarPago(id) {
      return this.update(id, { status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] });
    },

    calcStatus(conta) {
      if (conta.status === 'pago') return 'pago';
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      const venc = new Date(conta.data_vencimento + 'T00:00:00');
      return venc < hoje ? 'atrasado' : 'pendente';
    }
  },

  // ── CONTAS FIXAS ────────────────────────────────────────
  contasFixas: {
    async list() {
      const { data, error } = await db.from('contas_fixas').select('*').order('nome');
      if (error) throw error;
      return data || [];
    },

    async create(conta) {
      const { data, error } = await db.from('contas_fixas').insert([conta]).select();
      if (error) throw error;
      return data[0];
    },

    async update(id, updates) {
      const { data, error } = await db.from('contas_fixas').update(updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },

    async delete(id) {
      const { error } = await db.from('contas_fixas').delete().eq('id', id);
      if (error) throw error;
    },

    // Gera lançamentos mensais das contas fixas ativas
    async gerarLancamentosMes(anoMes) {
      const [ano, mes] = anoMes.split('-').map(Number);
      const fixas = await this.list();
      const ativas = fixas.filter(f => f.ativa);
      const novas = [];
      for (const f of ativas) {
        // Verifica se já existe lançamento este mês
        const dia = String(f.dia_vencimento).padStart(2, '0');
        const data = `${ano}-${String(mes).padStart(2,'0')}-${dia}`;
        const mesPad = String(mes).padStart(2,'0');
        const { data: exist } = await db.from('contas')
          .select('id').eq('conta_fixa_id', f.id)
          .gte('data_vencimento', `${ano}-${mesPad}-01`)
          .lte('data_vencimento', `${ano}-${mesPad}-${ultimoDiaMes(ano, mes)}`)
          .maybeSingle();
        if (!exist) {
          novas.push({
            nome: f.nome, valor: f.valor,
            data_vencimento: data, categoria: f.categoria,
            status: 'pendente', conta_fixa_id: f.id,
            observacoes: f.observacoes || ''
          });
        }
      }
      if (novas.length > 0) {
        const { data, error } = await db.from('contas').insert(novas).select();
        if (error) throw error;
        return data;
      }
      return [];
    }
  },

  // ── CARTÕES ─────────────────────────────────────────────
  cartoes: {
    async list() {
      const { data, error } = await db.from('cartoes').select('*').order('nome');
      if (error) throw error;
      return data || [];
    },

    async create(cartao) {
      const { data, error } = await db.from('cartoes').insert([cartao]).select();
      if (error) throw error;
      return data[0];
    },

    async update(id, updates) {
      const { data, error } = await db.from('cartoes').update(updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },

    async delete(id) {
      // Deletar compras associadas também
      await db.from('compras_cartao').delete().eq('cartao_id', id);
      const { error } = await db.from('cartoes').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ── COMPRAS CARTÃO ──────────────────────────────────────
  comprasCartao: {
    async list(cartaoId = null, anoMes = null) {
      let q = db.from('compras_cartao').select('*, cartoes(nome)').order('data_compra', { ascending: false });
      if (cartaoId) q = q.eq('cartao_id', cartaoId);
      if (anoMes) {
        const [ano, mes] = anoMes.split('-');
        const inicio = `${ano}-${mes}-01`;
        const fim = `${ano}-${mes}-${ultimoDiaMes(ano, mes)}`;
        q = q.gte('data_primeira_parcela', inicio).lte('data_primeira_parcela', fim);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    // Retorna todas as parcelas que vencem em determinado mês/cartão
    async getFatura(cartaoId, anoMes) {
      const [ano, mes] = anoMes.split('-');
      const mesPad = String(mes).padStart(2,'0');
      const inicio = `${ano}-${mesPad}-01`;
      const fim = `${ano}-${mesPad}-${ultimoDiaMes(ano, mes)}`;
      const { data, error } = await db.from('parcelas_cartao')
        .select('*, compras_cartao(descricao, cartao_id, total_parcelas)')
        .eq('cartao_id', cartaoId)
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim)
        .order('data_vencimento');
      if (error) throw error;
      return data || [];
    },

    async create(compra) {
      // Salva compra
      const { data: compraData, error: compraError } = await db.from('compras_cartao').insert([{
        cartao_id: compra.cartao_id,
        descricao: compra.descricao,
        valor_total: compra.valor_total,
        total_parcelas: compra.total_parcelas,
        data_compra: compra.data_compra,
        data_primeira_parcela: compra.data_primeira_parcela
      }]).select();
      if (compraError) throw compraError;
      const compraId = compraData[0].id;
      const valorParcela = compra.valor_total / compra.total_parcelas;
      // Gera parcelas
      const parcelas = [];
      for (let i = 0; i < compra.total_parcelas; i++) {
        const d = new Date(compra.data_primeira_parcela + 'T00:00:00');
        d.setMonth(d.getMonth() + i);
        parcelas.push({
          compra_id: compraId,
          cartao_id: compra.cartao_id,
          numero: i + 1,
          valor: parseFloat(valorParcela.toFixed(2)),
          data_vencimento: d.toISOString().split('T')[0],
          paga: false
        });
      }
      const { error: parcelasError } = await db.from('parcelas_cartao').insert(parcelas);
      if (parcelasError) throw parcelasError;
      return compraData[0];
    },

    async delete(id) {
      await db.from('parcelas_cartao').delete().eq('compra_id', id);
      const { error } = await db.from('compras_cartao').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ── EMPRÉSTIMOS ─────────────────────────────────────────
  emprestimos: {
    async list() {
      const { data, error } = await db.from('emprestimos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async create(emp) {
      const { data, error } = await db.from('emprestimos').insert([emp]).select();
      if (error) throw error;
      const empId = data[0].id;
      // Gera parcelas
      const parcelas = [];
      for (let i = 0; i < emp.total_parcelas; i++) {
        const d = new Date(emp.data_primeira_parcela + 'T00:00:00');
        d.setMonth(d.getMonth() + i);
        parcelas.push({
          emprestimo_id: empId,
          numero: i + 1,
          valor: emp.valor_parcela,
          data_vencimento: d.toISOString().split('T')[0],
          paga: false
        });
      }
      await db.from('parcelas_emprestimo').insert(parcelas);
      return data[0];
    },

    async getParcelas(empId) {
      const { data, error } = await db.from('parcelas_emprestimo')
        .select('*').eq('emprestimo_id', empId).order('numero');
      if (error) throw error;
      return data || [];
    },

    async marcarParcela(parcelaId, paga) {
      const { error } = await db.from('parcelas_emprestimo').update({ paga, data_pagamento: paga ? new Date().toISOString().split('T')[0] : null }).eq('id', parcelaId);
      if (error) throw error;
    },

    async update(id, updates) {
      const { error } = await db.from('emprestimos').update(updates).eq('id', id);
      if (error) throw error;
    },

    async delete(id) {
      await db.from('parcelas_emprestimo').delete().eq('emprestimo_id', id);
      const { error } = await db.from('emprestimos').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ── VR ──────────────────────────────────────────────────
  vr: {
    async getSaldo() {
      const { data, error } = await db.from('vr_saldo').select('*').maybeSingle();
      if (error) throw error;
      return data?.saldo || 0;
    },

    async setSaldo(saldo) {
      const { data: exist } = await db.from('vr_saldo').select('id').maybeSingle();
      if (exist) {
        await db.from('vr_saldo').update({ saldo }).eq('id', exist.id);
      } else {
        await db.from('vr_saldo').insert([{ saldo }]);
      }
    },

    async listTransacoes() {
      const { data, error } = await db.from('vr_transacoes').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },

    async addTransacao(tipo, valor, descricao) {
      const saldoAtual = await this.getSaldo();
      const novoSaldo = tipo === 'credito' ? saldoAtual + valor : saldoAtual - valor;
      await this.setSaldo(novoSaldo);
      const { error } = await db.from('vr_transacoes').insert([{
        tipo, valor, descricao, saldo_apos: novoSaldo
      }]);
      if (error) throw error;
      return novoSaldo;
    }
  },

  // ── RESUMO GERAL ────────────────────────────────────────
  async getResumo(anoMes) {
    const [ano, mes] = anoMes.split('-');
    const mesPad = String(mes).padStart(2,'0');
    const inicio = `${ano}-${mesPad}-01`;
    const fim = `${ano}-${mesPad}-${ultimoDiaMes(ano, mes)}`;

    // Contas do mês
    const { data: contas } = await db.from('contas').select('valor, status, data_vencimento')
      .gte('data_vencimento', inicio).lte('data_vencimento', fim);
    const totalPagar = (contas || []).filter(c => c.status !== 'pago').reduce((s, c) => s + Number(c.valor), 0);
    const totalPago = (contas || []).filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor), 0);
    const hoje = new Date().toISOString().split('T')[0];
    const atrasadas = (contas || []).filter(c => c.status === 'pendente' && c.data_vencimento < hoje).length;

    // Cartões - total de parcelas no mês
    const { data: parcelas } = await db.from('parcelas_cartao').select('valor')
      .gte('data_vencimento', inicio).lte('data_vencimento', fim);
    const totalCartoes = (parcelas || []).reduce((s, p) => s + Number(p.valor), 0);

    // Empréstimos - total pendente
    const { data: parcelasEmp } = await db.from('parcelas_emprestimo').select('valor').eq('paga', false);
    const totalEmprestimos = (parcelasEmp || []).reduce((s, p) => s + Number(p.valor), 0);

    // VR
    const saldoVR = await this.vr.getSaldo();

    return { totalPagar, totalPago, totalCartoes, totalEmprestimos, saldoVR, atrasadas };
  }
};
