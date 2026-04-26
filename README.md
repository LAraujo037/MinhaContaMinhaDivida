# 💰 FinançasPro — Sistema de Gestão Financeira Pessoal

Sistema web completo para controle financeiro pessoal, com suporte a dois usuários.
Desenvolvido em HTML + CSS + JavaScript puro, com Supabase como backend.

---

## 📁 Estrutura de Arquivos

```
financas/
├── index.html              ← Arquivo principal (abrir este)
├── css/
│   └── style.css           ← Estilos completos (dark/light mode)
├── js/
│   ├── config.js           ← ⚠️ CONFIGURE AQUI: URL e chave do Supabase
│   ├── utils.js            ← Utilitários de UI e formatação
│   ├── db-models.js        ← Todas as operações de banco de dados
│   └── pages.js            ← Renderização de páginas
└── supabase-migration.sql  ← Execute no Supabase SQL Editor
```

---

## 🚀 Configuração (Passo a Passo)

### 1. Criar projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em **New Project** e configure
3. Anote o **Project URL** e a **anon public key** (Settings → API)

### 2. Criar as tabelas
1. No painel do Supabase, vá em **SQL Editor**
2. Cole o conteúdo de `supabase-migration.sql` e execute
3. Todas as tabelas e políticas de segurança serão criadas

### 3. Criar os usuários autorizados
1. No Supabase, vá em **Authentication → Users**
2. Clique em **Add user** e crie os dois usuários:
   - `usuario1@email.com` + senha
   - `usuario2@email.com` + senha

### 4. Configurar o sistema
Abra `js/config.js` e substitua:

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://SEU_PROJECT_ID.supabase.co',  // ← sua URL
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY_AQUI',              // ← sua chave

  ALLOWED_EMAILS: [
    'seu_email@gmail.com',     // ← e-mail do usuário 1
    'email_parceiro@gmail.com' // ← e-mail do usuário 2
  ]
};
```

### 5. Publicar no GitHub Pages
1. Crie um repositório no GitHub (pode ser privado)
2. Faça upload de todos os arquivos
3. Vá em **Settings → Pages** e ative o GitHub Pages
4. Pronto! O sistema estará disponível em `https://seu-usuario.github.io/nome-repo`

---

## ✨ Funcionalidades

| Módulo | Funcionalidades |
|--------|----------------|
| **Visão Geral** | Resumo do mês: a pagar, pago, cartões, empréstimos, VR |
| **Contas a Pagar** | Cadastro, filtros por mês/status, marcar como pago, exportar CSV |
| **Contas Fixas** | Recorrência mensal automática, pausar/ativar |
| **Cartões** | Múltiplos cartões, compras parceladas, visualização de fatura |
| **Empréstimos** | Parcelas geradas automaticamente, progresso de quitação |
| **Vale Refeição** | Saldo separado, créditos, débitos, histórico |

## 🎨 Extras
- ☀️/🌙 Dark mode / Light mode
- 📱 Responsivo para celular
- ⬇️ Exportação CSV (contas e VR)
- ⚠️ Alertas de contas atrasadas
- 🔐 Acesso restrito a 2 e-mails

---

## ⚠️ Segurança

O sistema usa duas camadas de proteção:
1. **Frontend**: Verifica se o e-mail está na lista `ALLOWED_EMAILS` antes de fazer login
2. **Supabase RLS**: Row Level Security ativa em todas as tabelas — apenas usuários autenticados acessam os dados

> **Nota**: Para segurança máxima em produção, considere adicionar uma Edge Function no Supabase para validar os e-mails permitidos no servidor.
