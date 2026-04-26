// ════════════════════════════════════════════════════════════
//  pages.js — Renderização de todas as páginas/seções
// ════════════════════════════════════════════════════════════

const Pages = {

  // ── VISÃO GERAL ─────────────────────────────────────────
  async renderOverview() {
    const anoMes = Utils.currentYearMonth();
    const app = document.getElementById('page-content');
    app.innerHTML = `<div style="opacity:0.5;padding:40px;text-align:center">Carregando...</div>`;

    try {
      const r = await DB.getResumo(anoMes);
      const atrasadasAlert = r.atrasadas > 0 ?
        `<div class="alert-banner red">⚠ Você tem <strong>${r.atrasadas} conta(s) atrasada(s)</strong> este mês. Verifique na seção Contas a Pagar.</div>` : '';

      app.innerHTML = `
        ${atrasadasAlert}
        <div class="summary-grid">
          <div class="summary-card red">
            <div class="label">A Pagar</div>
            <div class="value">${Utils.formatCurrency(r.totalPagar)}</div>
            <div class="sub">${Utils.formatMonth(anoMes)}</div>
          </div>
          <div class="summary-card green">
            <div class="label">Pago</div>
            <div class="value">${Utils.formatCurrency(r.totalPago)}</div>
            <div class="sub">${Utils.formatMonth(anoMes)}</div>
          </div>
          <div class="summary-card blue">
            <div class="label">Em Cartões</div>
            <div class="value">${Utils.formatCurrency(r.totalCartoes)}</div>
            <div class="sub">Parcelas do mês</div>
          </div>
          <div class="summary-card yellow">
            <div class="label">Empréstimos</div>
            <div class="value">${Utils.formatCurrency(r.totalEmprestimos)}</div>
            <div class="sub">Saldo pendente</div>
          </div>
          <div class="summary-card" style="border-left:3px solid var(--green)">
            <div class="label">Saldo VR</div>
            <div class="value text-green">${Utils.formatCurrency(r.saldoVR)}</div>
            <div class="sub">Vale Refeição</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">📊 Resumo do mês — ${Utils.formatMonth(anoMes)}</span>
          </div>
          <div style="padding:24px">
            ${this._renderResumoBar('Contas pagas', r.totalPago, r.totalPago + r.totalPagar, 'green')}
            ${this._renderResumoBar('Cartões utilizados', r.totalCartoes, r.totalCartoes * 1.5, 'blue')}
            ${this._renderResumoBar('Empréstimos', r.totalEmprestimos, r.totalEmprestimos * 1.2, 'yellow')}
          </div>
        </div>
      `;
    } catch(e) {
      app.innerHTML = `<div class="alert-banner red">Erro ao carregar dados: ${e.message}</div>`;
    }
  },

  _renderResumoBar(label, val, total, color) {
    const pct = total > 0 ? Math.min(100, (val/total)*100) : 0;
    return `
      <div style="margin-bottom:20px">
        <div class="flex-between mb-4" style="margin-bottom:8px">
          <span style="font-size:0.85rem;color:var(--text-secondary)">${label}</span>
          <span style="font-weight:600">${Utils.formatCurrency(val)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${color}" style="width:${pct}%"></div>
        </div>
      </div>`;
  },

  // ── CONTAS A PAGAR ──────────────────────────────────────
  async renderContas() {
    const app = document.getElementById('page-content');
    const mesAtual = Utils.currentYearMonth();

    // Gera lançamentos das fixas automaticamente
    try { await DB.contasFixas.gerarLancamentosMes(mesAtual); } catch(e) {}

    app.innerHTML = `
      <div class="card-header" style="background:none;padding:0;margin-bottom:20px">
        <div class="filters">
          <select class="filter-select" id="filter-mes-contas"></select>
          <select class="filter-select" id="filter-status-contas">
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" onclick="Pages.exportarContas()">⬇ CSV</button>
          <button class="btn btn-primary" onclick="Pages.abrirModalConta()">+ Nova Conta</button>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Nome</th><th>Vencimento</th><th>Valor</th><th>Categoria</th><th>Status</th><th>Ações</th>
            </tr></thead>
            <tbody id="tbody-contas"><tr class="empty-row"><td colspan="6">Carregando...</td></tr></tbody>
          </table>
        </div>
      </div>
      ${this._modalConta()}
    `;

    Utils.fillMonthSelect('filter-mes-contas', mesAtual);
    document.getElementById('filter-mes-contas').addEventListener('change', () => this._loadContas());
    document.getElementById('filter-status-contas').addEventListener('change', () => this._loadContas());
    await this._loadContas();
  },

  async _loadContas() {
    const mes = document.getElementById('filter-mes-contas')?.value;
    const status = document.getElementById('filter-status-contas')?.value;
    const tbody = document.getElementById('tbody-contas');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Carregando...</td></tr>';

    let contas = await DB.contas.list({ mes, status });
    // Calcula status real (atrasado)
    contas = contas.map(c => ({ ...c, statusReal: Utils.calcStatusConta(c) }));
    if (status === 'atrasado') contas = contas.filter(c => c.statusReal === 'atrasado');
    if (status === 'pendente') contas = contas.filter(c => c.statusReal === 'pendente');

    if (!contas.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Nenhuma conta encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = contas.map(c => `
      <tr>
        <td class="strong">${c.nome}${c.conta_fixa_id ? ' <span style="font-size:.65rem;color:var(--text-muted)">[FIXA]</span>' : ''}</td>
        <td>${Utils.formatDate(c.data_vencimento)}</td>
        <td class="${c.statusReal === 'atrasado' ? 'text-red' : ''}" style="font-weight:600">${Utils.formatCurrency(c.valor)}</td>
        <td>${c.categoria || '—'}</td>
        <td>${Utils.statusBadge(c.statusReal)}</td>
        <td>
          <div style="display:flex;gap:4px">
            ${c.statusReal !== 'pago' ? `<button class="btn btn-success btn-icon btn-sm" title="Marcar como pago" onclick="Pages.pagarConta('${c.id}')">✓</button>` : ''}
            <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="Pages.editarConta('${c.id}')">✎</button>
            <button class="btn btn-danger btn-icon btn-sm" title="Excluir" onclick="Pages.deletarConta('${c.id}')">✕</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  _modalConta() {
    return `
    <div class="modal-overlay" id="modal-conta">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="modal-conta-title">Nova Conta</span>
          <button class="btn btn-ghost btn-icon" onclick="Utils.closeModal('modal-conta')">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-conta">
            <input type="hidden" name="id">
            <div class="form-grid">
              <div class="form-group full"><label>Nome da conta *</label><input name="nome" required placeholder="Ex: Conta de luz"></div>
              <div class="form-group"><label>Valor *</label><input name="valor" type="number" step="0.01" min="0" required placeholder="0,00"></div>
              <div class="form-group"><label>Data de vencimento *</label><input name="data_vencimento" type="date" required></div>
              <div class="form-group">
                <label>Categoria</label>
                <select name="categoria">
                  ${Utils.categorias.map(c => `<option>${c}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="status">
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
              <div class="form-group full"><label>Observações</label><textarea name="observacoes" placeholder="Observações opcionais..."></textarea></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('modal-conta')">Cancelar</button>
          <button class="btn btn-primary" onclick="Pages.salvarConta()">Salvar</button>
        </div>
      </div>
    </div>`;
  },

  abrirModalConta(data = null) {
    document.getElementById('modal-conta-title').textContent = data ? 'Editar Conta' : 'Nova Conta';
    Utils.resetForm('form-conta');
    if (data) Utils.fillForm('form-conta', data);
    Utils.openModal('modal-conta');
  },

  _contaCache: {},
  async editarConta(id) {
    const contas = await DB.contas.list({});
    const c = contas.find(x => x.id === id);
    if (c) this.abrirModalConta(c);
  },

  async salvarConta() {
    const form = document.getElementById('form-conta');
    const data = Utils.getFormData('form-conta');
    if (!data.nome || !data.valor || !data.data_vencimento) { Utils.toast('Preencha os campos obrigatórios.', 'error'); return; }
    try {
      if (data.id) {
        await DB.contas.update(data.id, { nome: data.nome, valor: parseFloat(data.valor), data_vencimento: data.data_vencimento, categoria: data.categoria, status: data.status, observacoes: data.observacoes });
        Utils.toast('Conta atualizada!', 'success');
      } else {
        delete data.id;
        await DB.contas.create({ ...data, valor: parseFloat(data.valor), status: 'pendente' });
        Utils.toast('Conta criada!', 'success');
      }
      Utils.closeModal('modal-conta');
      await this._loadContas();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
  },

  async pagarConta(id) {
    if (!Utils.confirm('Marcar como pago?')) return;
    try {
      await DB.contas.marcarPago(id);
      Utils.toast('Marcado como pago!', 'success');
      await this._loadContas();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
  },

  async deletarConta(id) {
    if (!Utils.confirm('Excluir esta conta?')) return;
    try {
      await DB.contas.delete(id);
      Utils.toast('Conta excluída.', 'info');
      await this._loadContas();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
  },

  async exportarContas() {
    const mes = document.getElementById('filter-mes-contas')?.value;
    const contas = await DB.contas.list({ mes });
    Utils.exportCSV(contas.map(c => ({
      Nome: c.nome, Valor: c.valor, Vencimento: c.data_vencimento,
      Categoria: c.categoria, Status: c.status, Observações: c.observacoes
    })), `contas_${mes}.csv`);
  },

  // ── CONTAS FIXAS ────────────────────────────────────────
  async renderContasFixas() {
    const app = document.getElementById('page-content');
    app.innerHTML = `
      <div class="card-header" style="background:none;padding:0;margin-bottom:20px">
        <p style="color:var(--text-secondary);font-size:.875rem">Contas que se repetem todo mês. Geram lançamentos automaticamente.</p>
        <button class="btn btn-primary" onclick="Pages.abrirModalFixa()">+ Nova Conta Fixa</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Valor</th><th>Dia Venc.</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="tbody-fixas"><tr class="empty-row"><td colspan="6">Carregando...</td></tr></tbody>
          </table>
        </div>
      </div>
      ${this._modalFixa()}
    `;
    await this._loadFixas();
  },

  async _loadFixas() {
    const tbody = document.getElementById('tbody-fixas');
    const fixas = await DB.contasFixas.list();
    if (!fixas.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Nenhuma conta fixa cadastrada.</td></tr>'; return; }
    tbody.innerHTML = fixas.map(f => `
      <tr>
        <td class="strong">${f.nome}</td>
        <td style="font-weight:600">${Utils.formatCurrency(f.valor)}</td>
        <td>Dia ${f.dia_vencimento}</td>
        <td>${f.categoria || '—'}</td>
        <td>${Utils.statusBadge(f.ativa ? 'ativo' : 'pausado')}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-icon btn-sm" title="${f.ativa ? 'Pausar' : 'Ativar'}" onclick="Pages.toggleFixa('${f.id}', ${f.ativa})">${f.ativa ? '⏸' : '▶'}</button>
            <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="Pages.editarFixa('${f.id}')">✎</button>
            <button class="btn btn-danger btn-icon btn-sm" title="Excluir" onclick="Pages.deletarFixa('${f.id}')">✕</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  _modalFixa() {
    return `
    <div class="modal-overlay" id="modal-fixa">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="modal-fixa-title">Nova Conta Fixa</span>
          <button class="btn btn-ghost btn-icon" onclick="Utils.closeModal('modal-fixa')">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-fixa">
            <input type="hidden" name="id">
            <div class="form-grid">
              <div class="form-group full"><label>Nome *</label><input name="nome" required placeholder="Ex: Netflix, Aluguel..."></div>
              <div class="form-group"><label>Valor *</label><input name="valor" type="number" step="0.01" required></div>
              <div class="form-group"><label>Dia do vencimento *</label><input name="dia_vencimento" type="number" min="1" max="31" required placeholder="Ex: 10"></div>
              <div class="form-group">
                <label>Categoria</label>
                <select name="categoria">${Utils.categorias.map(c => `<option>${c}</option>`).join('')}</select>
              </div>
              <div class="form-group full"><label>Observações</label><textarea name="observacoes"></textarea></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('modal-fixa')">Cancelar</button>
          <button class="btn btn-primary" onclick="Pages.salvarFixa()">Salvar</button>
        </div>
      </div>
    </div>`;
  },

  abrirModalFixa(data = null) {
    document.getElementById('modal-fixa-title').textContent = data ? 'Editar Conta Fixa' : 'Nova Conta Fixa';
    Utils.resetForm('form-fixa');
    if (data) Utils.fillForm('form-fixa', data);
    Utils.openModal('modal-fixa');
  },

  async editarFixa(id) {
    const fixas = await DB.contasFixas.list();
    const f = fixas.find(x => x.id === id);
    if (f) this.abrirModalFixa(f);
  },

  async salvarFixa() {
    const data = Utils.getFormData('form-fixa');
    if (!data.nome || !data.valor || !data.dia_vencimento) { Utils.toast('Preencha os campos obrigatórios.', 'error'); return; }
    try {
      const payload = { nome: data.nome, valor: parseFloat(data.valor), dia_vencimento: parseInt(data.dia_vencimento), categoria: data.categoria, observacoes: data.observacoes, ativa: true };
      if (data.id) { await DB.contasFixas.update(data.id, payload); Utils.toast('Atualizado!', 'success'); }
      else { await DB.contasFixas.create(payload); Utils.toast('Conta fixa criada!', 'success'); }
      Utils.closeModal('modal-fixa');
      await this._loadFixas();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
  },

  async toggleFixa(id, ativa) {
    await DB.contasFixas.update(id, { ativa: !ativa });
    Utils.toast(ativa ? 'Recorrência pausada.' : 'Recorrência ativada.', 'info');
    await this._loadFixas();
  },

  async deletarFixa(id) {
    if (!Utils.confirm('Excluir esta conta fixa? Os lançamentos já gerados não serão afetados.')) return;
    await DB.contasFixas.delete(id);
    Utils.toast('Removida.', 'info');
    await this._loadFixas();
  },

  // ── CARTÕES ─────────────────────────────────────────────
  async renderCartoes() {
    const app = document.getElementById('page-content');
    app.innerHTML = `
      <div class="tabs">
        <button class="tab-btn active" onclick="Pages.switchCartaoTab('cartoes', this)">💳 Meus Cartões</button>
        <button class="tab-btn" onclick="Pages.switchCartaoTab('fatura', this)">📄 Faturas</button>
        <button class="tab-btn" onclick="Pages.switchCartaoTab('compras', this)">🛒 Lançar Compra</button>
      </div>
      <div id="tab-cartoes" class="tab-panel active"></div>
      <div id="tab-fatura" class="tab-panel"></div>
      <div id="tab-compras" class="tab-panel"></div>
      ${this._modalCartao()}
      ${this._modalCompra()}
    `;
    await this._loadCartoes();
  },

  switchCartaoTab(name, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(`tab-${name}`);
    if (panel) panel.classList.add('active');
    if (name === 'fatura') this._loadFatura();
    if (name === 'compras') this._loadCompras();
  },

  async _loadCartoes() {
    const tab = document.getElementById('tab-cartoes');
    const cartoes = await DB.cartoes.list();
    if (!cartoes.length) {
      tab.innerHTML = `
        <div style="text-align:center;padding:48px;color:var(--text-muted)">
          <div style="font-size:3rem;margin-bottom:16px">💳</div>
          <p>Nenhum cartão cadastrado.</p>
          <button class="btn btn-primary mt-4" onclick="Pages.abrirModalCartao()" style="margin-top:16px">+ Adicionar Cartão</button>
        </div>`;
      return;
    }
    tab.innerHTML = `
      <div style="margin-bottom:16px;text-align:right">
        <button class="btn btn-primary" onclick="Pages.abrirModalCartao()">+ Novo Cartão</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px">
        ${cartoes.map(c => this._cardVisual(c)).join('')}
      </div>`;
  },

  _cardVisual(c) {
    const colors = [
      'linear-gradient(135deg,#1e3a8a,#2563eb)', 'linear-gradient(135deg,#1a2e1a,#166534)',
      'linear-gradient(135deg,#3b1a4a,#7c3aed)', 'linear-gradient(135deg,#4a1a1a,#dc2626)',
      'linear-gradient(135deg,#1a3a4a,#0891b2)'
    ];
    const bg = colors[c.nome.charCodeAt(0) % colors.length];
    return `
    <div>
      <div class="card-visual" style="background:${bg}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="card-name">${c.nome}</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-icon btn-sm" style="color:rgba(255,255,255,0.7);font-size:.8rem" onclick="Pages.editarCartao('${c.id}')">✎</button>
            <button class="btn btn-ghost btn-icon btn-sm" style="color:rgba(255,255,255,0.7);font-size:.8rem" onclick="Pages.deletarCartao('${c.id}')">✕</button>
          </div>
        </div>
        <div class="card-limit">LIMITE TOTAL</div>
        <div class="card-amount">${Utils.formatCurrency(c.limite)}</div>
        <div class="card-dates">
          <div>Fecha dia <strong>${c.dia_fechamento}</strong></div>
          <div>Vence dia <strong>${c.dia_vencimento}</strong></div>
        </div>
      </div>
    </div>`;
  },

  _modalCartao() {
    return `
    <div class="modal-overlay" id="modal-cartao">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="modal-cartao-title">Novo Cartão</span>
          <button class="btn btn-ghost btn-icon" onclick="Utils.closeModal('modal-cartao')">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-cartao">
            <input type="hidden" name="id">
            <div class="form-grid">
              <div class="form-group full"><label>Nome do cartão *</label><input name="nome" required placeholder="Ex: Nubank, Itaú..."></div>
              <div class="form-group"><label>Limite *</label><input name="limite" type="number" step="0.01" required placeholder="5000"></div>
              <div class="form-group"><label>Dia fechamento *</label><input name="dia_fechamento" type="number" min="1" max="31" required></div>
              <div class="form-group"><label>Dia vencimento *</label><input name="dia_vencimento" type="number" min="1" max="31" required></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('modal-cartao')">Cancelar</button>
          <button class="btn btn-primary" onclick="Pages.salvarCartao()">Salvar</button>
        </div>
      </div>
    </div>`;
  },

  _modalCompra() {
    return `
    <div class="modal-overlay" id="modal-compra">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Lançar Compra</span>
          <button class="btn btn-ghost btn-icon" onclick="Utils.closeModal('modal-compra')">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-compra">
            <div class="form-grid">
              <div class="form-group full">
                <label>Cartão *</label>
                <select name="cartao_id" id="select-cartao-compra" required></select>
              </div>
              <div class="form-group full"><label>Descrição *</label><input name="descricao" required placeholder="Ex: Supermercado, Roupa..."></div>
              <div class="form-group"><label>Valor total *</label><input name="valor_total" type="number" step="0.01" required></div>
              <div class="form-group"><label>Nº parcelas</label><input name="total_parcelas" type="number" min="1" max="60" value="1"></div>
              <div class="form-group"><label>Data da compra *</label><input name="data_compra" type="date" required></div>
              <div class="form-group"><label>1ª parcela em *</label><input name="data_primeira_parcela" type="date" required></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('modal-compra')">Cancelar</button>
          <button class="btn btn-primary" onclick="Pages.salvarCompra()">Lançar</button>
        </div>
      </div>
    </div>`;
  },

  abrirModalCartao(data = null) {
    document.getElementById('modal-cartao-title').textContent = data ? 'Editar Cartão' : 'Novo Cartão';
    Utils.resetForm('form-cartao');
    if (data) Utils.fillForm('form-cartao', data);
    Utils.openModal('modal-cartao');
  },

  async editarCartao(id) {
    const cartoes = await DB.cartoes.list();
    const c = cartoes.find(x => x.id === id);
    if (c) this.abrirModalCartao(c);
  },

  async salvarCartao() {
    const data = Utils.getFormData('form-cartao');
    const payload = { nome: data.nome, limite: parseFloat(data.limite), dia_fechamento: parseInt(data.dia_fechamento), dia_vencimento: parseInt(data.dia_vencimento) };
    try {
      if (data.id) { await DB.cartoes.update(data.id, payload); Utils.toast('Cartão atualizado!', 'success'); }
      else { await DB.cartoes.create(payload); Utils.toast('Cartão adicionado!', 'success'); }
      Utils.closeModal('modal-cartao');
      await this._loadCartoes();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
  },

  async deletarCartao(id) {
    if (!Utils.confirm('Excluir este cartão e todas as compras?')) return;
    await DB.cartoes.delete(id);
    Utils.toast('Cartão removido.', 'info');
    await this._loadCartoes();
  },

  async _loadFatura() {
    const tab = document.getElementById('tab-fatura');
    const cartoes = await DB.cartoes.list();
    if (!cartoes.length) { tab.innerHTML = '<p style="color:var(--text-muted);padding:20px">Nenhum cartão cadastrado.</p>'; return; }
    const mesAtual = Utils.currentYearMonth();
    tab.innerHTML = `
      <div class="filters mb-4" style="margin-bottom:20px">
        <select class="filter-select" id="filter-cartao-fatura">
          ${cartoes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
        </select>
        <select class="filter-select" id="filter-mes-fatura"></select>
      </div>
      <div id="fatura-content">Selecione um cartão e mês.</div>
    `;
    Utils.fillMonthSelect('filter-mes-fatura', mesAtual);
    document.getElementById('filter-cartao-fatura').addEventListener('change', () => this._renderFatura());
    document.getElementById('filter-mes-fatura').addEventListener('change', () => this._renderFatura());
    await this._renderFatura();
  },

  async _renderFatura() {
    const cartaoId = document.getElementById('filter-cartao-fatura')?.value;
    const mes = document.getElementById('filter-mes-fatura')?.value;
    const div = document.getElementById('fatura-content');
    if (!cartaoId || !mes || !div) return;
    div.innerHTML = '<p style="color:var(--text-muted)">Carregando fatura...</p>';
    const parcelas = await DB.comprasCartao.getFatura(cartaoId, mes);
    const total = parcelas.reduce((s, p) => s + Number(p.valor), 0);
    if (!parcelas.length) { div.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Sem lançamentos neste mês.</div>'; return; }
    div.innerHTML = `
      <div class="card mb-4" style="margin-bottom:16px;padding:16px 20px;background:var(--accent-dim);border-color:rgba(79,142,247,0.3)">
        <span style="color:var(--text-secondary)">Total da fatura:</span>
        <strong style="font-size:1.3rem;margin-left:12px;color:var(--accent)">${Utils.formatCurrency(total)}</strong>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Descrição</th><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead>
        <tbody>
          ${parcelas.map(p => `
            <tr>
              <td class="strong">${p.compras_cartao?.descricao || '—'}</td>
              <td>${p.numero}/${p.compras_cartao?.total_parcelas || 1}</td>
              <td>${Utils.formatDate(p.data_vencimento)}</td>
              <td style="font-weight:600">${Utils.formatCurrency(p.valor)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div></div>`;
  },

  async _loadCompras() {
    const tab = document.getElementById('tab-compras');
    const cartoes = await DB.cartoes.list();
    if (!cartoes.length) { tab.innerHTML = '<p style="color:var(--text-muted);padding:20px">Cadastre um cartão primeiro.</p>'; return; }
    tab.innerHTML = `
      <div style="margin-bottom:16px">
        <button class="btn btn-primary" onclick="Pages.abrirModalCompra()">+ Lançar Compra</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Cartão</th><th>Descrição</th><th>Valor</th><th>Parcelas</th><th>Data</th><th>Ações</th></tr></thead>
        <tbody id="tbody-compras"><tr class="empty-row"><td colspan="6">Carregando...</td></tr></tbody>
      </table></div></div>`;
    const compras = await DB.comprasCartao.list();
    const tbody = document.getElementById('tbody-compras');
    if (!compras.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Nenhuma compra lançada.</td></tr>'; return; }
    tbody.innerHTML = compras.map(c => `
      <tr>
        <td>${c.cartoes?.nome || '—'}</td>
        <td class="strong">${c.descricao}</td>
        <td style="font-weight:600">${Utils.formatCurrency(c.valor_total)}</td>
        <td>${c.total_parcelas}x de ${Utils.formatCurrency(c.valor_total / c.total_parcelas)}</td>
        <td>${Utils.formatDate(c.data_compra)}</td>
        <td><button class="btn btn-danger btn-icon btn-sm" onclick="Pages.deletarCompra('${c.id}')">✕</button></td>
      </tr>`).join('');
  },

  async abrirModalCompra() {
    const cartoes = await DB.cartoes.list();
    const sel = document.getElementById('select-cartao-compra');
    if (sel) sel.innerHTML = cartoes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    const hoje = new Date().toISOString().split('T')[0];
    document.querySelector('#form-compra [name="data_compra"]').value = hoje;
    Utils.openModal('modal-compra');
  },

  async salvarCompra() {
    const data = Utils.getFormData('form-compra');
    if (!data.cartao_id || !data.descricao || !data.valor_total) { Utils.toast('Preencha os campos obrigatórios.', 'error'); return; }
    try {
      await DB.comprasCartao.create({ ...data, valor_total: parseFloat(data.valor_total), total_parcelas: parseInt(data.total_parcelas) || 1 });
      Utils.toast('Compra lançada!', 'success');
      Utils.closeModal('modal-compra');
      await this._loadCompras();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
  },

  async deletarCompra(id) {
    if (!Utils.confirm('Excluir esta compra e todas as parcelas?')) return;
    await DB.comprasCartao.delete(id);
    Utils.toast('Excluído.', 'info');
    await this._loadCompras();
  },

  // ── EMPRÉSTIMOS ─────────────────────────────────────────
  async renderEmprestimos() {
    const app = document.getElementById('page-content');
    app.innerHTML = `
      <div style="margin-bottom:20px;text-align:right">
        <button class="btn btn-primary" onclick="Pages.abrirModalEmp()">+ Novo Empréstimo</button>
      </div>
      <div id="lista-emprestimos">Carregando...</div>
      ${this._modalEmp()}
      <div class="modal-overlay" id="modal-parcelas-emp">
        <div class="modal" style="max-width:680px">
          <div class="modal-header">
            <span class="modal-title">Parcelas</span>
            <button class="btn btn-ghost btn-icon" onclick="Utils.closeModal('modal-parcelas-emp')">✕</button>
          </div>
          <div class="modal-body" id="parcelas-emp-content"></div>
        </div>
      </div>
    `;
    await this._loadEmprestimos();
  },

  async _loadEmprestimos() {
    const div = document.getElementById('lista-emprestimos');
    const emps = await DB.emprestimos.list();
    if (!emps.length) { div.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)">Nenhum empréstimo cadastrado.</div>'; return; }

    let html = '<div style="display:grid;gap:16px">';
    for (const e of emps) {
      const parcelas = await DB.emprestimos.getParcelas(e.id);
      const pagas = parcelas.filter(p => p.paga).length;
      const pendentes = parcelas.length - pagas;
      const saldoRestante = pendentes * e.valor_parcela;
      const pct = parcelas.length > 0 ? (pagas / parcelas.length * 100) : 0;
      html += `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${e.nome}</div>
              <div style="font-size:.8rem;color:var(--text-muted);margin-top:4px">${e.total_parcelas} parcelas de ${Utils.formatCurrency(e.valor_parcela)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn btn-secondary btn-sm" onclick="Pages.verParcelas('${e.id}')">Ver parcelas</button>
              <button class="btn btn-danger btn-icon btn-sm" onclick="Pages.deletarEmp('${e.id}')">✕</button>
            </div>
          </div>
          <div style="padding:16px 20px">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px">
              <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Pagas</div><div style="font-weight:700;color:var(--green)">${pagas}</div></div>
              <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Pendentes</div><div style="font-weight:700;color:var(--yellow)">${pendentes}</div></div>
              <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Saldo</div><div style="font-weight:700;color:var(--red)">${Utils.formatCurrency(saldoRestante)}</div></div>
            </div>
            <div class="progress-bar"><div class="progress-fill ${pct === 100 ? 'green' : 'blue'}" style="width:${pct}%"></div></div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:6px">${pct.toFixed(0)}% quitado</div>
          </div>
        </div>`;
    }
    html += '</div>';
    div.innerHTML = html;
  },

  _modalEmp() {
    return `
    <div class="modal-overlay" id="modal-emp">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Novo Empréstimo/Financiamento</span>
          <button class="btn btn-ghost btn-icon" onclick="Utils.closeModal('modal-emp')">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-emp">
            <div class="form-grid">
              <div class="form-group full"><label>Nome *</label><input name="nome" required placeholder="Ex: Financiamento carro, Empréstimo pessoal..."></div>
              <div class="form-group"><label>Valor total</label><input name="valor_total" type="number" step="0.01" placeholder="Opcional"></div>
              <div class="form-group"><label>Nº de parcelas *</label><input name="total_parcelas" type="number" min="1" required></div>
              <div class="form-group"><label>Valor da parcela *</label><input name="valor_parcela" type="number" step="0.01" required></div>
              <div class="form-group"><label>Taxa de juros (% a.m.)</label><input name="taxa_juros" type="number" step="0.01" placeholder="Opcional"></div>
              <div class="form-group"><label>1ª parcela em *</label><input name="data_primeira_parcela" type="date" required></div>
              <div class="form-group full"><label>Observações</label><textarea name="observacoes"></textarea></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('modal-emp')">Cancelar</button>
          <button class="btn btn-primary" onclick="Pages.salvarEmp()">Salvar</button>
        </div>
      </div>
    </div>`;
  },

  abrirModalEmp() { Utils.resetForm('form-emp'); Utils.openModal('modal-emp'); },

  async salvarEmp() {
    const data = Utils.getFormData('form-emp');
    if (!data.nome || !data.total_parcelas || !data.valor_parcela || !data.data_primeira_parcela) { Utils.toast('Preencha os campos obrigatórios.', 'error'); return; }
    try {
      await DB.emprestimos.create({ ...data, total_parcelas: parseInt(data.total_parcelas), valor_parcela: parseFloat(data.valor_parcela), valor_total: parseFloat(data.valor_total) || 0 });
      Utils.toast('Empréstimo cadastrado!', 'success');
      Utils.closeModal('modal-emp');
      await this._loadEmprestimos();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
  },

  async verParcelas(empId) {
    const div = document.getElementById('parcelas-emp-content');
    div.innerHTML = 'Carregando...';
    Utils.openModal('modal-parcelas-emp');
    const parcelas = await DB.emprestimos.getParcelas(empId);
    div.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead>
        <tbody>
          ${parcelas.map(p => `
            <tr>
              <td>${p.numero}</td>
              <td>${Utils.formatDate(p.data_vencimento)}</td>
              <td style="font-weight:600">${Utils.formatCurrency(p.valor)}</td>
              <td>${p.paga ? '<span class="badge badge-paid">✓ Paga</span>' : '<span class="badge badge-pending">⏳ Pendente</span>'}</td>
              <td>
                <button class="btn btn-${p.paga ? 'ghost' : 'success'} btn-sm" onclick="Pages.toggleParcela('${p.id}', ${p.paga}, '${empId}')">
                  ${p.paga ? 'Desfazer' : 'Marcar paga'}
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>`;
  },

  async toggleParcela(parcelaId, paga, empId) {
    await DB.emprestimos.marcarParcela(parcelaId, !paga);
    await this.verParcelas(empId);
    await this._loadEmprestimos();
  },

  async deletarEmp(id) {
    if (!Utils.confirm('Excluir este empréstimo e todas as parcelas?')) return;
    await DB.emprestimos.delete(id);
    Utils.toast('Removido.', 'info');
    await this._loadEmprestimos();
  },

  // ── VR ──────────────────────────────────────────────────
  async renderVR() {
    const app = document.getElementById('page-content');
    app.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>`;
    try {
      const saldo = await DB.vr.getSaldo();
      const transacoes = await DB.vr.listTransacoes();
      app.innerHTML = `
        <div class="vr-balance">
          <div style="font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-secondary);margin-bottom:8px">SALDO VALE REFEIÇÃO</div>
          <div class="amount" id="vr-saldo-display">${Utils.formatCurrency(saldo)}</div>
          <div class="vr-actions">
            <button class="btn btn-success" onclick="Pages.abrirModalVR('credito')">+ Adicionar crédito</button>
            <button class="btn btn-danger" onclick="Pages.abrirModalVR('debito')">− Registrar gasto</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Histórico de movimentações</span>
            <button class="btn btn-secondary btn-sm" onclick="Pages.exportarVR()">⬇ CSV</button>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Saldo após</th></tr></thead>
            <tbody>
              ${!transacoes.length ? '<tr class="empty-row"><td colspan="5">Sem movimentações.</td></tr>' :
                transacoes.map(t => `
                  <tr>
                    <td>${new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>${t.tipo === 'credito' ? '<span class="badge badge-paid">↑ Crédito</span>' : '<span class="badge badge-overdue">↓ Débito</span>'}</td>
                    <td>${t.descricao || '—'}</td>
                    <td class="${t.tipo === 'credito' ? 'text-green' : 'text-red'}" style="font-weight:600">${t.tipo === 'credito' ? '+' : '-'}${Utils.formatCurrency(t.valor)}</td>
                    <td>${Utils.formatCurrency(t.saldo_apos)}</td>
                  </tr>`).join('')}
            </tbody>
          </table></div>
        </div>

        <div class="modal-overlay" id="modal-vr">
          <div class="modal">
            <div class="modal-header">
              <span class="modal-title" id="modal-vr-title">Movimentação VR</span>
              <button class="btn btn-ghost btn-icon" onclick="Utils.closeModal('modal-vr')">✕</button>
            </div>
            <div class="modal-body">
              <form id="form-vr">
                <input type="hidden" name="tipo">
                <div class="form-grid">
                  <div class="form-group"><label>Valor *</label><input name="valor" type="number" step="0.01" required placeholder="0,00"></div>
                  <div class="form-group"><label>Descrição</label><input name="descricao" placeholder="Ex: Almoço, Recarga..."></div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="Utils.closeModal('modal-vr')">Cancelar</button>
              <button class="btn btn-primary" onclick="Pages.salvarVR()">Confirmar</button>
            </div>
          </div>
        </div>
      `;
    } catch(e) {
      app.innerHTML = `<div class="alert-banner red">Erro: ${e.message}</div>`;
    }
  },

  abrirModalVR(tipo) {
    document.getElementById('modal-vr-title').textContent = tipo === 'credito' ? '+ Adicionar Crédito VR' : '− Registrar Gasto VR';
    document.querySelector('#form-vr [name="tipo"]').value = tipo;
    Utils.resetForm('form-vr');
    document.querySelector('#form-vr [name="tipo"]').value = tipo;
    Utils.openModal('modal-vr');
  },

  async salvarVR() {
    const data = Utils.getFormData('form-vr');
    if (!data.valor || parseFloat(data.valor) <= 0) { Utils.toast('Informe um valor válido.', 'error'); return; }
    try {
      const novoSaldo = await DB.vr.addTransacao(data.tipo, parseFloat(data.valor), data.descricao);
      Utils.toast('Movimentação registrada!', 'success');
      Utils.closeModal('modal-vr');
      await this.renderVR();
    } catch(e) { Utils.toast('Erro: ' + e.message, 'error'); }
  },

  async exportarVR() {
    const trans = await DB.vr.listTransacoes();
    Utils.exportCSV(trans.map(t => ({
      Data: new Date(t.created_at).toLocaleDateString('pt-BR'),
      Tipo: t.tipo, Descrição: t.descricao, Valor: t.valor, SaldoApós: t.saldo_apos
    })), 'vr_historico.csv');
  }
};
