# 💰 FinançasPro — Sistema de Gestão Financeira Pessoal

Sistema web completo para controle financeiro pessoal de duas pessoas, com sincronização em tempo real via Supabase.

---

## ✨ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| 🏠 **Visão Geral** | Resumo do mês, saldo, alertas, cards configuráveis com olhinho e blur |
| 📋 **Contas a Pagar** | Cadastro, filtros, status automático (pago/pendente/atrasado), CSV |
| 🔄 **Contas Fixas** | Recorrências mensais que viram lançamentos automaticamente |
| 💳 **Cartões** | Múltiplos cartões com limite, faturas por mês, compras parceladas |
| 🏦 **Empréstimos** | Parcelas com progresso, dono (Meu/Outro com nome), filtros |
| 💵 **Receitas** | Salário, adiantamento, pensão e Loja Enjoei. Recorrências fixas |
| 🍽️ **Vale Refeição** | Saldo separado, créditos e débitos, histórico |
| 🎯 **Orçamento** | Limites mensais por categoria com barras de progresso |
| 🚀 **Metas** | Objetivos financeiros com progresso e contribuições |
| ⚙️ **Configurações** | Backup JSON, importar, exportar CSV, perfil |
| 🛡️ **Admin** | Cor de destaque do sistema, módulos visíveis, zona de risco |

### Extras
- 🌙/☀️ Dark/Light mode
- 📱 Responsivo (funciona no celular)
- 👁 Olhinho global e por card (borra valores)
- ⚙ Painel para mostrar/ocultar cards
- ↕️ Drag-and-drop na sidebar (admin reorganiza menu)
- 🔄 Sincronização em tempo real entre os 2 dispositivos
- 🎨 Tema futurista com gradientes ciano/violeta

---

## 📁 Estrutura

```
financas/
├── index.html                    ← Página principal
├── README.md                     ← Este arquivo
├── supabase-migration.sql        ← Execute no SQL Editor do Supabase
├── css/
│   └── style.css                 ← Tema futurista completo
└── js/
    ├── config.js                 ← ⚠️ CONFIGURE AQUI: Supabase + e-mails
    ├── supabase-adapter.js       ← Camada de persistência
    └── app.js                    ← Toda a lógica do app
```

---

## 🚀 Setup (5 minutos)

### 1. Criar projeto Supabase
1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Defina nome, senha do banco, região (recomendo São Paulo)
3. Aguarde 2 min para o projeto ficar pronto

### 2. Criar tabela
1. **SQL Editor** → **New query**
2. Cole o conteúdo de `supabase-migration.sql`
3. Clique em **Run**

### 3. Habilitar Realtime
1. **Database** → **Replication**
2. Encontre a tabela `appdata` e clique para habilitar

### 4. Criar os 2 usuários
1. **Authentication** → **Users** → **Add user**
2. Crie 2 usuários (você + sua esposa) com senhas

### 5. Configurar o app
Abra `js/config.js` e edite:

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://abcdefg.supabase.co',  // Project Settings → API
  SUPABASE_ANON_KEY: 'eyJhbG...',                // Project Settings → API
  ALLOWED_EMAILS: [
    'voce@email.com',
    'esposa@email.com'
  ],
  ADMIN_EMAIL: 'voce@email.com'  // Quem acessa o painel admin
};
```

### 6. Publicar no GitHub Pages
1. Crie um repositório no GitHub (pode ser privado)
2. Faça upload dos arquivos
3. **Settings** → **Pages** → Source: `main` branch → **Save**
4. Aguarde ~1 min e acesse `https://seu-usuario.github.io/nome-repo`

---

## 🔐 Segurança

- **Whitelist de e-mails** — apenas os e-mails em `ALLOWED_EMAILS` conseguem fazer login
- **Row Level Security** — Supabase bloqueia qualquer acesso sem autenticação
- **Admin restrito** — apenas `ADMIN_EMAIL` vê o painel de configuração
- **Cache local** — funciona offline e sincroniza ao reconectar

---

## 💡 Notas técnicas

- **Schema JSONB** — todos os dados financeiros ficam em um único registro JSONB compartilhado entre os 2 usuários. Simples, flexível, fácil de evoluir.
- **Realtime** — quando um usuário salva algo, o outro vê na hora (sem precisar atualizar)
- **Debounce de 800ms** — múltiplas edições são agrupadas para reduzir requests
- **Cache local** — primeira renderização é instantânea via localStorage

Para volumes maiores (>1000 transações/mês), considere dividir em tabelas relacionais.

---

## 🆘 Problemas comuns

**"Acesso não autorizado"** → e-mail não está em `ALLOWED_EMAILS`

**Dados não aparecem** → verifique se a tabela `appdata` foi criada e tem RLS habilitado

**Não sincroniza entre dispositivos** → habilite Realtime em Database → Replication
