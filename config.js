// ════════════════════════════════════════════════════════════
//  config.js — Configurações do Supabase e usuários autorizados
// ════════════════════════════════════════════════════════════

const CONFIG = {
  // ⚠️  SUBSTITUA pelos seus dados do Supabase
  SUPABASE_URL: 'https://irvjmgxflpebxwynhqce.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydmptZ3hmbHBlYnh3eW5ocWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxOTEwMzUsImV4cCI6MjA5Mjc2NzAzNX0.jmDFem_GK696EDDzeLnc_u-eXDeY_z8FHwCGNTHv2zg',

  // Apenas estes e-mails podem acessar o sistema
  ALLOWED_EMAILS: [
    'zero37@hotmail.com',
    'anapaulamoreiradh19@gmail.com'
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
