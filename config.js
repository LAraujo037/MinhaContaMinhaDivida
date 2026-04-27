// ════════════════════════════════════════════════════════════
//  config.js — Configurações do Supabase e usuários autorizados
// ════════════════════════════════════════════════════════════

const CONFIG = {
  SUPABASE_URL: 'https://rbfrzjbcetgdmhvbszrd.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZnJ6amJjZXRnZG1odmJzenJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNDg0NTYsImV4cCI6MjA5MjgyNDQ1Nn0.DgvF9phY54TeaHL6xPo1O63VUYGLNwtU-gsrMUzkj-Y',

  ALLOWED_EMAILS: [
    'zero37@hotmail.com',
    'anapaulamoreiradh19@gmail.com'
  ],

  ADMIN_EMAIL: 'zero37@hotmail.com'
};

// Inicializa cliente Supabase via CDN
const { createClient } = supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
