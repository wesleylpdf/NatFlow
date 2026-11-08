import './styles.css'
import { supabase, supabaseConfigurado } from '@/lib/supabaseClient'
import { atualizarSenha, initAuth, onAuthChange } from '@/hooks/useAuth'
import { criarAuthForm } from '@/components/AuthForm'
import { criarHeader } from '@/components/Header'
import { renderClientes } from '@/components/ClientesView'
import { renderResumoFinanceiro } from '@/components/ResumoFinanceiroView'
import { renderClienteDetalhe } from '@/components/ClienteDetalheView'
import { renderHistorico } from '@/components/HistoricoView'
import { renderEquipe } from '@/components/EquipeView'
import { abrirFormModal } from '@/components/Modal'
import { toast } from '@/utils/toast'
import { iniciarVerificacaoDeAtualizacoes } from '@/utils/atualizacao'

const app = document.querySelector<HTMLElement>('#app')!

function mostrarAvisoConfiguracao(): void {
  app.innerHTML = `
    <div class="max-w-md mx-auto mt-16 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/40 rounded-3xl p-6 text-center shadow">
      <p class="text-3xl mb-2">⚙️</p>
      <h2 class="font-black text-lg mb-2">Configuração pendente</h2>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Defina as variáveis <code class="font-mono text-emerald-600">VITE_SUPABASE_URL</code> e
        <code class="font-mono text-emerald-600">VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code>
        (local) ou nas Environment Variables da Vercel.
      </p>
    </div>
  `
}

// ---------- Roteamento por hash ----------
// #/              -> lista de clientes
// #/cliente/:id   -> tela do cliente (saldo, compras, pagamentos)
// #/historico     -> histórico geral de alterações
// #/equipe        -> controle de membros autorizados
let viewEl: HTMLElement | null = null

function rotear(): void {
  if (!viewEl) return
  // Novo container a cada navegação: renders assíncronos antigos escrevem
  // em um elemento já descartado e não sobrescrevem a tela atual.
  const novo = document.createElement('main')
  viewEl.replaceChildren(novo)

  const hash = window.location.hash || '#/'
  const matchCliente = hash.match(/^#\/cliente\/([0-9a-f-]{36})$/i)

  if (matchCliente) {
    void renderClienteDetalhe(novo, matchCliente[1])
  } else if (hash.startsWith('#/financeiro')) {
    void renderResumoFinanceiro(novo)
  } else if (hash.startsWith('#/historico')) {
    void renderHistorico(novo)
  } else if (hash.startsWith('#/equipe')) {
    void renderEquipe(novo)
  } else {
    void renderClientes(novo)
  }
  window.scrollTo({ top: 0 })
}

window.addEventListener('hashchange', rotear)

// ---------- Autenticação ----------
let usuarioRenderizado: string | null | undefined

function iniciar(): void {
  iniciarVerificacaoDeAtualizacoes()
  initAuth()

  onAuthChange(state => {
    if (state.loading) {
      if (!app.innerHTML.trim()) {
        app.innerHTML = `
          <div class="min-h-screen flex items-center justify-center">
            <div class="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>`
      }
      return
    }

    const userId = state.user?.id ?? null
    // Evita re-render em eventos como TOKEN_REFRESHED se já estiver com tela renderizada
    if (userId === usuarioRenderizado && app.querySelector('#view, #auth-form')) return
    usuarioRenderizado = userId

    if (!state.user) {
      viewEl = null
      criarAuthForm(app)
      return
    }

    app.innerHTML = `<div id="header"></div><div id="view"></div>`
    void criarHeader(app.querySelector<HTMLElement>('#header')!, state.user.email ?? '')
    viewEl = app.querySelector<HTMLElement>('#view')!
    rotear()
  })

  // Link de recuperação de senha: pede a nova senha
  supabase.auth.onAuthStateChange(event => {
    if (event !== 'PASSWORD_RECOVERY') return
    setTimeout(() => {
      abrirFormModal({
        titulo: 'Definir nova senha',
        campos: [{ nome: 'senha', label: 'Nova senha', tipo: 'password', obrigatorio: true }],
        onSalvar: async v => {
          if (v.senha.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres')
          await atualizarSenha(v.senha)
          toast.success('Senha atualizada!')
        },
      })
    }, 300)
  })
}

if (supabaseConfigurado) {
  iniciar()
} else {
  mostrarAvisoConfiguracao()
}
