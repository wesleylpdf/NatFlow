# NatFlow 🌿

Controle financeiro de clientes para venda de produtos de **beleza e saúde** com **controle de equipe e auditoria completa**.

- **Clientes não criam conta**: apenas você e as pessoas que você autorizar acessam o sistema.
- **Multi-usuário com permissões**:
  - `Admin`: cadastra e edita clientes, lança produtos e pagamentos, autoriza ou remove membros da equipe.
  - `Membro`: cadastra clientes, lança compras/pagamentos e edita registros.
- **Rastreabilidade total e autoria**:
  - O banco registra automaticamente quem criou e quem editou pela última vez cada cliente, produto ou pagamento.
  - **Histórico imutável**: tela dedicada que grava o que mudou, quem mudou (nome e e-mail) e a data/hora exata, com comparação de valores antigos e novos.
- **Tela do cliente**:
  - Saldo devedor calculado automaticamente: **Entradas** (valores pagos) e **Saídas** (produtos comprados).
  - Lançamento, edição e exclusão de produtos e pagamentos.
  - Atalho direto para o WhatsApp do cliente.
- **Layout responsivo**:
  - Inspirado no Organiza Pouco (cards arredondados, tons de esmeralda/slate, dark/light mode, toasts e feedback visual instantâneo).

**Stack:** TypeScript · Vite · Tailwind CSS · Supabase (Auth + Postgres + RLS) · Vercel

---

## 1. Configurando o Banco de Dados (Supabase)

1. Crie um projeto em <https://supabase.com>.
2. Abra o arquivo [`supabase/schema.sql`](supabase/schema.sql):
   - Na última seção (`PRIMEIRO ADMINISTRADOR`), substitua `'SEU-EMAIL@exemplo.com'` e `'Seu nome'` pelos seus dados reais.
3. No painel do Supabase, vá em **SQL Editor → New query**, cole o conteúdo completo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
4. Em **Project Settings → API**, copie:
   - **Project URL**
   - **anon public key**
5. Em **Authentication → URL Configuration**:
   - Defina **Site URL** com a URL da sua aplicação (ex: `https://natflow.vercel.app` ou `http://localhost:5173`).
   - Adicione `http://localhost:5173` em **Redirect URLs**.

> **Proteção ativa:** qualquer pessoa que tentar criar conta sem que seu e-mail esteja previamente cadastrado na tabela de autorizados será bloqueada pelo banco de dados com a mensagem `"Este e-mail não foi autorizado pelo administrador"`.

---

## 2. Rodando localmente

```bash
cp .env.example .env    # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev             # http://localhost:5173
```

Ao abrir o app pela primeira vez:
1. Clique em **"Não tem conta? Cadastre-se"**.
2. Digite o mesmo e-mail que você definiu como primeiro administrador no `schema.sql` e escolha uma senha.
3. Confirme o e-mail (caso a confirmação esteja ativada no Supabase) e faça login.

---

## 3. Comandos Úteis

| Comando           | Descrição                         |
| ----------------- | --------------------------------- |
| `npm run dev`     | Inicia servidor de desenvolvimento|
| `npm run build`   | Type check + build de produção    |
| `npm run preview` | Servir o build localmente         |
| `npm test`        | Executa testes unitários (Vitest) |

---

## 4. GitHub & Vercel

### GitHub:
```bash
git add .
git commit -m "feat: controle de equipe e auditoria de lancamentos"
git push origin main
```

### Vercel:
1. Em <https://vercel.com/new>, importe o repositório.
2. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Clique em **Deploy**.

---

## Estrutura do Projeto

```
src/
├── components/
│   ├── AuthForm.ts            # Login, cadastro de autorizados e recuperação
│   ├── Header.ts              # Logo, identificação do usuário, navegação e tema
│   ├── ClientesView.ts        # Lista de clientes com saldo e busca
│   ├── ClienteDetalheView.ts  # Painel de saldo, produtos e pagamentos com autoria
│   ├── EquipeView.ts          # Gerenciamento de membros autorizados e permissões
│   ├── HistoricoView.ts       # Log de auditoria (quem criou, editou ou excluiu)
│   └── Modal.ts               # Modais de formulário e confirmação
├── hooks/useAuth.ts           # Gerenciamento de sessão Supabase
├── lib/supabaseClient.ts      # Cliente Supabase
├── services/
│   ├── clientes.ts            # CRUD de clientes
│   ├── compras.ts             # CRUD de produtos comprados
│   ├── pagamentos.ts          # CRUD de pagamentos recebidos
│   ├── equipe.ts              # Gestão de autorizados e perfil
│   └── historico.ts           # Consulta de auditoria
├── types/                     # Interfaces TypeScript
├── utils/                     # Formatadores, cálculo de saldo, toasts, classes UI
└── main.ts                    # Roteamento por hash e inicialização
supabase/schema.sql            # Schema com RLS, triggers de autoria e histórico
```
