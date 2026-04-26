// ════════════════════════════════════════════════════════════
//  utils.js — Utilitários de UI, formatação e helpers
// ════════════════════════════════════════════════════════════

const Utils = {

  // ── FORMATAÇÃO ──────────────────────────────────────────
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  },

  formatMonth(anoMes) {
    if (!anoMes) return '';
    const [y, m] = anoMes.split('-');
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${months[parseInt(m)-1]} ${y}`;
  },

  currentYearMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  },

  monthOptions(range = 12) {
    const opts = [];
    const d = new Date();
    for (let i = -2; i <= range; i++) {
      const dt = new Date(d.getFullYear(), d.getMonth() + i, 1);
      const val = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      opts.push({ value: val, label: this.formatMonth(val) });
    }
    return opts;
  },

  // ── STATUS ──────────────────────────────────────────────
  statusBadge(status) {
    const map = {
      pago:      { cls: 'badge-paid',    icon: '✓', label: 'Pago' },
      pendente:  { cls: 'badge-pending', icon: '⏳', label: 'Pendente' },
      atrasado:  { cls: 'badge-overdue', icon: '⚠', label: 'Atrasado' },
      ativo:     { cls: 'badge-active',  icon: '●', label: 'Ativo' },
      pausado:   { cls: 'badge-paused',  icon: '⏸', label: 'Pausado' }
    };
    const s = map[status] || map.pendente;
    return `<span class="badge ${s.cls}">${s.icon} ${s.label}</span>`;
  },

  calcStatusConta(conta) {
    if (conta.status === 'pago') return 'pago';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = new Date(conta.data_vencimento + 'T00:00:00');
    return venc < hoje ? 'atrasado' : 'pendente';
  },

  // ── TOAST ───────────────────────────────────────────────
  toast(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span style="font-size:1.1em">${icons[type]}</span> ${msg}`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, duration);
  },

  // ── MODAL ───────────────────────────────────────────────
  openModal(id) { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); },

  // ── CONFIRM ─────────────────────────────────────────────
  confirm(msg) { return window.confirm(msg); },

  // ── FORM HELPERS ────────────────────────────────────────
  getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const fd = new FormData(form);
    const obj = {};
    fd.forEach((v, k) => { obj[k] = v; });
    return obj;
  },

  resetForm(formId) {
    document.getElementById(formId)?.reset();
  },

  fillForm(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;
    Object.entries(data).forEach(([k, v]) => {
      const el = form.querySelector(`[name="${k}"]`);
      if (el) {
        if (el.type === 'checkbox') el.checked = v;
        else el.value = v || '';
      }
    });
  },

  // ── MONTH SELECT OPTIONS ────────────────────────────────
  fillMonthSelect(selectId, selectedVal = null) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const cur = selectedVal || this.currentYearMonth();
    sel.innerHTML = this.monthOptions().map(o =>
      `<option value="${o.value}" ${o.value === cur ? 'selected' : ''}>${o.label}</option>`
    ).join('');
  },

  // ── CATEGORY OPTIONS ────────────────────────────────────
  categorias: [
    'Moradia','Alimentação','Transporte','Saúde','Educação',
    'Lazer','Vestuário','Serviços','Financeiro','Outros'
  ],

  // ── EXPORT CSV ──────────────────────────────────────────
  exportCSV(data, filename) {
    if (!data.length) { this.toast('Nenhum dado para exportar.', 'error'); return; }
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click(); URL.revokeObjectURL(url);
    this.toast('Exportação concluída!', 'success');
  },

  // ── DARK MODE ───────────────────────────────────────────
  initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeBtn(saved);
  },

  toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.updateThemeBtn(next);
  },

  updateThemeBtn(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '🌙';
  },

  // ── SIDEBAR MOBILE ──────────────────────────────────────
  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  }
};
