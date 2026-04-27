// ════════════════════════════════════════════════════════════
//  supabase-adapter.js — Camada de persistência via Supabase
//  Substitui o localStorage do demo por banco de dados real
// ════════════════════════════════════════════════════════════
//
//  Mantém o objeto global `S` no formato que o app.js espera,
//  mas sincroniza com o Supabase a cada save.
//  Tabela única "appdata" com chave-valor JSONB para simplicidade.
// ════════════════════════════════════════════════════════════

const STORE_KEY_LS = 'fp_cache_v1'; // cache local opcional

// Estado global
let S = null;

const STATE_TEMPLATE = {
  user: null,
  contas: [],
  fixas: [],
  cartoes: [],
  compras: [],
  emprestimos: [],
  vr: { saldo: 0 },
  vrTrans: [],
  receitas: [],
  metas: [],
  budgets: {},
  profile: { nome: '', email: '', moeda: 'BRL' },
  adminCfg: {
    vrEnabled: true,
    accentColor: '#22d3ee',
    modulosVisiveis: {
      contas: true, fixas: true, cartoes: true,
      emprestimos: true, receitas: true, vr: true,
    }
  }
};

// ── AUTENTICAÇÃO ────────────────────────────────────────────
async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return null;
  const email = session.user.email.toLowerCase();
  if (!CONFIG.ALLOWED_EMAILS.includes(email)) {
    await sb.auth.signOut();
    return null;
  }
  return session.user;
}

async function loginSupabase(email, password) {
  if (!CONFIG.ALLOWED_EMAILS.includes(email.toLowerCase())) {
    throw new Error('Acesso não autorizado para este e-mail.');
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function logoutSupabase() {
  await sb.auth.signOut();
  S = null;
}

// ── PERSISTÊNCIA ────────────────────────────────────────────
// Estratégia: tabela "appdata" com 1 linha compartilhada entre
// os usuários autorizados (financeiro do casal é compartilhado)

async function loadStore() {
  // Cache local primeiro (carregamento instantâneo)
  try {
    const cached = localStorage.getItem(STORE_KEY_LS);
    if (cached) S = JSON.parse(cached);
  } catch (e) {}

  // Busca dados frescos do Supabase
  try {
    const { data, error } = await sb
      .from('appdata')
      .select('payload')
      .eq('id', 'shared')
      .maybeSingle();

    if (error) throw error;

    if (data?.payload) {
      S = { ...STATE_TEMPLATE, ...data.payload };
    } else {
      // Primeira vez: cria registro inicial
      S = { ...STATE_TEMPLATE };
      await sb.from('appdata').insert({ id: 'shared', payload: S });
    }
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    if (!S) S = { ...STATE_TEMPLATE };
  }

  // Pega usuário logado
  const user = await checkAuth();
  S.user = user?.email || null;

  // Atualiza cache local
  localStorage.setItem(STORE_KEY_LS, JSON.stringify(S));
}

let _saveTimer = null;
function saveStore() {
  // Salva no cache local imediatamente
  try {
    localStorage.setItem(STORE_KEY_LS, JSON.stringify(S));
  } catch (e) {}

  // Debounce: agrupa múltiplos saves em 800ms
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      // Não salva o user (vem do auth)
      const payload = { ...S };
      delete payload.user;
      const { error } = await sb
        .from('appdata')
        .upsert({ id: 'shared', payload, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (e) {
      console.error('Erro ao salvar no Supabase:', e);
    }
  }, 800);
}

// ── REALTIME (sincronização entre dispositivos) ─────────────
function subscribeRealtime(onUpdate) {
  const channel = sb
    .channel('appdata-changes')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'appdata', filter: 'id=eq.shared' },
      (payload) => {
        if (payload.new?.payload) {
          const oldUser = S?.user;
          S = { ...STATE_TEMPLATE, ...payload.new.payload, user: oldUser };
          if (onUpdate) onUpdate();
        }
      }
    )
    .subscribe();
  return channel;
}
