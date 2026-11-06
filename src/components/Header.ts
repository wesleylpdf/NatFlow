import { logout } from '@/hooks/useAuth'
import { obterPerfilAtual, limparCachePerfil, atualizarMeuPerfil } from '@/services/equipe'
import { abrirFormModal } from '@/components/Modal'
import { escaparHTML } from '@/utils/format'
import { toast, mensagemErro } from '@/utils/toast'
import { sincronizarBarraSistema } from '@/utils/ui'
import { acionarInstalacaoPWA, onDisponibilidadeInstalacao } from '@/utils/pwaInstall'

const CHAVE_TEMA = 'natflow_tema'

function temaEscuroAtivo(): boolean {
  return document.documentElement.classList.contains('dark')
}

function atualizarIconeTema(container: HTMLElement): void {
  const icone = container.querySelector('#theme-icon')
  if (icone) icone.textContent = temaEscuroAtivo() ? '☀️' : '🌙'
}

function atualizarLinksNavegacao(container: HTMLElement): void {
  const hash = window.location.hash || '#/'
  const links = container.querySelectorAll<HTMLAnchorElement>('[data-nav]')
  links.forEach(link => {
    const rota = link.getAttribute('href')
    const ativo =
      rota === '#/'
        ? hash === '#/' || hash.startsWith('#/cliente')
        : hash.startsWith(rota || '___')

    if (ativo) {
      link.className =
        'flex-1 sm:flex-none text-center text-xs font-black px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 shadow-sm transition whitespace-nowrap shrink-0'
    } else {
      link.className =
        'flex-1 sm:flex-none text-center text-xs font-bold px-2 sm:px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition whitespace-nowrap shrink-0'
    }
  })
}

/**
 * Modal para o usuário logado editar seu próprio nome e Chave PIX
 */
export function abrirModalMeuPerfil(aoSalvar?: () => void): void {
  void (async () => {
    try {
      const perfil = await obterPerfilAtual(true)
      if (!perfil) {
        toast.warning('Perfil não encontrado')
        return
      }

      abrirFormModal({
        titulo: 'Meu Perfil & Chave PIX',
        campos: [
          {
            nome: 'nome',
            label: 'Seu Nome',
            tipo: 'text',
            valor: perfil.nome,
            obrigatorio: true,
            placeholder: 'Nome de exibição',
          },
          {
            nome: 'chave_pix',
            label: 'Sua Chave PIX (para cobranças)',
            tipo: 'text',
            valor: perfil.chave_pix || '',
            obrigatorio: false,
            placeholder: 'CPF, CNPJ, Celular, E-mail ou Chave Aleatória',
          },
        ],
        onSalvar: async v => {
          await atualizarMeuPerfil({
            nome: v.nome,
            chave_pix: v.chave_pix,
          })
          toast.success('Perfil e Chave PIX atualizados com sucesso!')
          if (aoSalvar) aoSalvar()
        },
      })
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao carregar perfil'))
    }
  })()
}

export async function criarHeader(container: HTMLElement, email: string): Promise<void> {
  let nomeExibicao = email.split('@')[0]
  let badgePapel = ''
  let temPix = false
  let chavePixTexto = ''

  try {
    const perfil = await obterPerfilAtual()
    if (perfil) {
      nomeExibicao = perfil.nome
      temPix = Boolean(perfil.chave_pix)
      chavePixTexto = perfil.chave_pix || ''
      const ehAdmin = perfil.papel === 'admin'
      badgePapel = ehAdmin
        ? `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold uppercase border border-amber-500/30 shrink-0">Admin</span>`
        : `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase shrink-0">Membro</span>`
    }
  } catch {
    // fallback mantendo email
  }

  const badgePix = temPix
    ? `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-500/30 shrink-0" title="Chave PIX: ${escaparHTML(chavePixTexto)}">🔑 PIX</span>`
    : `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold border border-slate-300 dark:border-slate-700 hover:text-emerald-500 shrink-0">+ PIX</span>`

  container.innerHTML = `
    <header class="max-w-3xl mx-auto mb-4 space-y-2">
      <!-- Barra Superior Principal -->
      <div class="flex items-center justify-between gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-sm">
        <!-- Lado Esquerdo: Logo + Título + Perfil/PIX -->
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <a href="#/" class="shrink-0" title="Ir para início">
            <img src="/logo-natflow.svg" alt="NatFlow" class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-sm shadow-emerald-500/30 object-contain">
          </a>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-1.5">
              <a href="#/" class="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white shrink-0 hover:underline">NatFlow</a>
              <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold shrink-0">v${__BUILD_VERSION__}</span>
            </div>
            <button id="btn-perfil-header" type="button" class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-0 hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition group cursor-pointer mt-0.5" title="Clique para editar seu nome e sua Chave PIX">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span class="font-semibold truncate max-w-[85px] sm:max-w-[140px] group-hover:underline text-[11px] sm:text-xs">${escaparHTML(nomeExibicao)}</span>
              <span class="flex items-center gap-1 shrink-0">
                ${badgePapel}
                ${badgePix}
              </span>
            </button>
          </div>
        </div>

        <!-- Lado Direito: Instalar App + Tema + Sair -->
        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button id="btn-instalar-app" type="button" class="hidden items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm active:scale-95 transition shrink-0" title="Instalar aplicativo NatFlow no seu celular ou computador">
            <span>📲</span>
            <span class="hidden sm:inline">Instalar</span>
            <span>App</span>
          </button>

          <button id="theme-toggle" title="Alternar tema" class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition active:scale-95" aria-label="Alternar tema">
            <span id="theme-icon" class="text-xs sm:text-sm">☀️</span>
          </button>

          <button id="logout-btn" class="bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-500/20 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold hover:bg-rose-500 hover:text-white transition active:scale-95 shrink-0" title="Sair da conta">
            <span class="hidden sm:inline">Sair</span>
            <span class="sm:hidden text-xs">🚪 Sair</span>
          </button>
        </div>
      </div>

      <!-- Navegação Responsiva Sem Quebra -->
      <nav class="flex items-center gap-1 sm:gap-1.5 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 p-1 rounded-2xl shadow-sm overflow-x-auto no-scrollbar">
        <a href="#/" data-nav class="flex-1 sm:flex-none text-center text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0">
          👥 Clientes
        </a>
        <a href="#/historico" data-nav class="flex-1 sm:flex-none text-center text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0">
          📜 <span class="hidden sm:inline">Histórico de Edições</span><span class="sm:hidden">Histórico</span>
        </a>
        <a href="#/equipe" data-nav class="flex-1 sm:flex-none text-center text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0">
          🛡️ <span class="hidden sm:inline">Equipe & Acessos</span><span class="sm:hidden">Equipe</span>
        </a>
      </nav>
    </header>
  `

  sincronizarBarraSistema()
  atualizarIconeTema(container)
  atualizarLinksNavegacao(container)

  window.addEventListener('hashchange', () => atualizarLinksNavegacao(container))

  // Controle de exibição do botão de Instalação PWA
  const btnInstalar = container.querySelector<HTMLButtonElement>('#btn-instalar-app')!
  onDisponibilidadeInstalacao(disponivel => {
    if (disponivel) {
      btnInstalar.classList.remove('hidden')
      btnInstalar.classList.add('inline-flex')
    } else {
      btnInstalar.classList.add('hidden')
      btnInstalar.classList.remove('inline-flex')
    }
  })

  btnInstalar.addEventListener('click', async () => {
    const resultado = await acionarInstalacaoPWA()
    if (resultado === 'instalado') {
      toast.success('NatFlow instalado com sucesso!')
      btnInstalar.classList.add('hidden')
    } else if (resultado === 'instrucoes_ios') {
      toast.info('Para instalar no iPhone/iPad: toque em Compartilhar (⬆️) e selecione "Adicionar à Tela de Início"')
    } else if (resultado === 'indisponivel') {
      toast.info('O aplicativo já está instalado ou seu navegador não suporta instalação direta.')
    }
  })

  container.querySelector('#btn-perfil-header')!.addEventListener('click', () => {
    abrirModalMeuPerfil(() => {
      void criarHeader(container, email)
    })
  })

  container.querySelector('#theme-toggle')!.addEventListener('click', () => {
    const escuro = document.documentElement.classList.toggle('dark')
    try {
      localStorage.setItem(CHAVE_TEMA, escuro ? 'dark' : 'light')
    } catch {
      // ignora erro de storage
    }
    sincronizarBarraSistema(escuro)
    atualizarIconeTema(container)
  })

  container.querySelector('#logout-btn')!.addEventListener('click', async () => {
    try {
      limparCachePerfil()
      await logout()
    } catch (e) {
      toast.error(mensagemErro(e, 'Erro ao sair'))
    }
  })
}
