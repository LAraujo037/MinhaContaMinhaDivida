// ════════════════════════════════════════════════════════════
//  config.js — Configurações do Supabase e usuários autorizados
// ════════════════════════════════════════════════════════════

const CONFIG = {
  // ⚠️  SUBSTITUA pelos seus dados do Supabase
  SUPABASE_URL: 'https://SEU_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY_AQUI',

  // Apenas estes e-mails podem acessar o sistema
  ALLOWED_EMAILS: [
    'usuario1@email.com',
    'usuario2@email.com'
  ]
};

// ════════════════════════════════════════════════════════════
//  Inicializa cliente Supabase (via CDN)
// ════════════════════════════════════════════════════════════
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ════════════════════════════════════════════════════════════
//  auth.js — Módulo de autenticação
// ════════════════════════════════════════════════════════════

const Auth = {
  currentUser: null,

  async init() {
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      if (this.isAllowed(session.user.email)) {
        this.currentUser = session.user;
        return true;
      } else {
        await this.logout();
        return false;
      }
    }
    return false;
  },

  isAllowed(email) {
    return CONFIG.ALLOWED_EMAILS.includes(email?.toLowerCase());
  },

  async login(email, password) {
    if (!this.isAllowed(email)) {
      throw new Error('Acesso não autorizado para este e-mail.');
    }
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    return data.user;
  },

  async logout() {
    await db.auth.signOut();
    this.currentUser = null;
    location.reload();
  },

  getUserEmail() {
    return this.currentUser?.email || '';
  }
};
