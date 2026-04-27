// ════════════════════════════════════════════════════════════
//  config.js — Configurações do Supabase e usuários autorizados
// ════════════════════════════════════════════════════════════

const CONFIG = {
  // ⚠️  SUBSTITUA pelos seus dados do Supabase
  // Encontre em: Project Settings → API
  SUPABASE_URL: 'https://SEU_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY_AQUI',

  // ⚠️  Apenas estes e-mails podem acessar o sistema
  ALLOWED_EMAILS: [
    'usuario1@email.com',
    'usuario2@email.com'
  ],

  // ⚠️  Apenas este e-mail tem acesso ao painel admin
  ADMIN_EMAIL: 'usuario1@email.com'
};

// Inicializa cliente Supabase via CDN
const { createClient } = supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
