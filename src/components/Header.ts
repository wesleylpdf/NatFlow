import { logout } from '@/hooks/useAuth'
import { obterPerfilAtual, limparCachePerfil, atualizarMeuPerfil } from '@/services/equipe'
import { abrirFormModal, criarOverlay } from '@/components/Modal'
import { CHANGELOG } from '@/data/changelog'
import { escaparHTML } from '@/utils/format'
import { toast, mensagemErro } from '@/utils/toast'
import { cls, sincronizarBarraSistema } from '@/utils/ui'
import { acionarInstalacaoPWA, onDisponibilidadeInstalacao } from '@/utils/pwaInstall'
import {
  verificarAtualizacaoManual,
  obterDadosUltimaVersaoPublicada,
  recarregarIgnorandoCache,
  type InfoVersaoPublicada,
} from '@/utils/atualizacao'

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
    let ativo = false
    if (rota === '#/financeiro') {
      ativo = hash.startsWith('#/financeiro')
    } else if (rota === '#/' || rota === '#/clientes') {
      ativo = (hash === '#/' || hash === '#/clientes' || hash.startsWith('#/cliente/')) && !hash.startsWith('#/financeiro')
    } else if (rota === '#/historico') {
      ativo = hash.startsWith('#/historico')
    } else if (rota === '#/equipe') {
      ativo = hash.startsWith('#/equipe')
    }

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
 * Modal para configurar a Chave PIX e o Nome do Beneficiário.
 * IMPORTANTE: Não edita nem altera o nome de usuário membro da equipe!
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
        titulo: 'Configurar Chave PIX do Negócio',
        campos: [
          {
            nome: 'chave_pix',
            label: 'Chave PIX (para cobranças)',
            tipo: 'text',
            valor: perfil.chave_pix || '',
            obrigatorio: false,
            placeholder: 'Ex: (11) 99999-9999, CPF, CNPJ ou E-mail',
            ajuda: 'Celular pode ser digitado com DDD como (11) 99999-9999. O sistema padroniza automaticamente com +55.',
          },
          {
            nome: 'beneficiario_pix',
            label: 'Nome do Beneficiário no PIX (Titular da conta / Empresa)',
            tipo: 'text',
            valor: perfil.beneficiario_pix || '',
            obrigatorio: false,
            placeholder: 'Ex: Natália Cosméticos ou Nome do Titular da conta',
          },
        ],
        onSalvar: async v => {
          // ATENÇÃO: Atualiza estritamente os dados do PIX e Beneficiário,
          // preservando intacto o nome do usuário membro da equipe.
          await atualizarMeuPerfil({
            chave_pix: v.chave_pix,
            beneficiario_pix: v.beneficiario_pix,
          })
          toast.success('Chave PIX e Beneficiário atualizados com sucesso!')
          if (aoSalvar) aoSalvar()
        },
      })
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao carregar perfil'))
    }
  })()
}

/**
 * Abre o modal interativo com o histórico de novidades, alterações e remoções (Changelog).
 * Caso haja novidades publicadas no servidor mais recentes que a versão desta aba, elas
 * são exibidas com destaque e botão de atualização imediata antes do reload.
 */
export function abrirModalChangelog(dadosServidor?: InfoVersaoPublicada | null): void {
  const infoServidor = dadosServidor || obterDadosUltimaVersaoPublicada()

  let listaItens = [...CHANGELOG]
  if (infoServidor?.changelog && Array.isArray(infoServidor.changelog)) {
    const versoesLocais = new Set(listaItens.map(i => i.versao.replace(/^v/i, '')))
    const itensNovos = infoServidor.changelog.filter(i => !versoesLocais.has(i.versao.replace(/^v/i, '')))
    if (itensNovos.length > 0) {
      listaItens = [...itensNovos, ...listaItens]
    }
  }

  const versaoServidorNum = infoServidor?.version || null
  const temNovaVersaoServidor = Boolean(
    versaoServidorNum && versaoServidorNum !== __BUILD_VERSION__
  )

  const versoesHTML = listaItens
    .map(item => {
      const versaoItemNum = item.versao.replace(/^v/i, '')
      const ehNovaVersaoServidor = temNovaVersaoServidor && versaoItemNum === versaoServidorNum
      const ehVersaoAtualInstalada = versaoItemNum === __BUILD_VERSION__

      let badgeVersao = ''
      if (ehNovaVersaoServidor) {
        badgeVersao = `
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black tracking-wide shrink-0 animate-pulse flex items-center gap-1 shadow-sm">
              <span>✨</span> Nova Versão Disponível • v${escaparHTML(versaoServidorNum!)}
            </span>
            <button type="button" id="btn-atualizar-pelo-modal" class="text-[11px] font-black px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-sm transition flex items-center gap-1 cursor-pointer">
              <span>🔄</span> Instalar Agora
            </button>
          </div>
        `
      } else if (ehVersaoAtualInstalada) {
        badgeVersao = `<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black tracking-wide shrink-0">Instalada nesta aba • v${__BUILD_VERSION__}</span>`
      } else {
        badgeVersao = `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold shrink-0">${escaparHTML(item.versao)}</span>`
      }

      const secaoAdicionado =
        item.adicionado && item.adicionado.length > 0
          ? `
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <span>✨</span><span>Novidades</span>
            </div>
            <ul class="space-y-1 text-xs text-slate-700 dark:text-slate-300 pl-2">
              ${item.adicionado
                .map(
                  texto =>
                    `<li class="flex items-start gap-1.5"><span class="text-emerald-500 shrink-0 font-bold">•</span><span>${escaparHTML(texto)}</span></li>`
                )
                .join('')}
            </ul>
          </div>
        `
          : ''

      const secaoAlterado =
        item.alterado && item.alterado.length > 0
          ? `
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
              <span>🔄</span><span>Alterado / Melhorias</span>
            </div>
            <ul class="space-y-1 text-xs text-slate-700 dark:text-slate-300 pl-2">
              ${item.alterado
                .map(
                  texto =>
                    `<li class="flex items-start gap-1.5"><span class="text-sky-500 shrink-0 font-bold">•</span><span>${escaparHTML(texto)}</span></li>`
                )
                .join('')}
            </ul>
          </div>
        `
          : ''

      const secaoRemovido =
        item.removido && item.removido.length > 0
          ? `
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <span>🗑️</span><span>Removido / Simplificado</span>
            </div>
            <ul class="space-y-1 text-xs text-slate-700 dark:text-slate-300 pl-2">
              ${item.removido
                .map(
                  texto =>
                    `<li class="flex items-start gap-1.5"><span class="text-rose-500 shrink-0 font-bold">•</span><span>${escaparHTML(texto)}</span></li>`
                )
                .join('')}
            </ul>
          </div>
        `
          : ''

      return `
        <div class="p-3.5 rounded-2xl border ${
          ehNovaVersaoServidor
            ? 'border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/15 ring-1 ring-amber-500/30 shadow-md'
            : ehVersaoAtualInstalada
            ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
        } space-y-2.5">
          <div class="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
            <div class="flex items-center gap-2 flex-wrap">
              ${badgeVersao}
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${escaparHTML(item.data)}</span>
            </div>
          </div>
          <h4 class="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
            ${escaparHTML(item.titulo)}
          </h4>
          <div class="space-y-2 pt-1">
            ${secaoAdicionado}
            ${secaoAlterado}
            ${secaoRemovido}
          </div>
        </div>
      `
    })
    .join('')

  const subtituloModal = temNovaVersaoServidor
    ? `Versão nesta aba: <strong class="text-emerald-600 dark:text-emerald-400 font-black">v${__BUILD_VERSION__}</strong> • <strong class="text-amber-500 font-extrabold">Nova versão disponível: v${escaparHTML(versaoServidorNum!)}</strong>`
    : `Versão instalada: <strong class="text-emerald-600 dark:text-emerald-400 font-black">v${__BUILD_VERSION__}</strong> • Histórico de novidades e melhorias.`

  const overlay = criarOverlay(`
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
            🚀
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              Atualizações do NatFlow
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ${subtituloModal}
            </p>
          </div>
        </div>
        <button type="button" data-fechar class="${cls.btnIcone} text-lg shrink-0" title="Fechar">✕</button>
      </div>

      <!-- Barra de Ferramentas de Atualização -->
      <div class="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
        <button id="btn-verificar-att-modal" type="button" class="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition shadow-sm cursor-pointer" title="Verificar se há nova versão no servidor">
          <span>🔍</span> Verificar Atualizações no Servidor
        </button>
      </div>

      <div class="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        ${versoesHTML}
      </div>

      <div class="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
        <button type="button" data-fechar class="${cls.btnPrimario} w-full sm:w-auto text-xs py-2 px-4">
          Entendido, fechar
        </button>
      </div>
    </div>
  `)

  const fechar = (): void => overlay.remove()
  overlay.querySelectorAll('[data-fechar]').forEach(btn => btn.addEventListener('click', fechar))

  overlay.querySelector('#btn-atualizar-pelo-modal')?.addEventListener('click', () => {
    fechar()
    if (versaoServidorNum) {
      recarregarIgnorandoCache(versaoServidorNum)
    }
  })

  overlay.querySelector('#btn-verificar-att-modal')?.addEventListener('click', () => {
    void verificarAtualizacaoManual()
  })

  overlay.addEventListener('click', e => {
    if (e.target === overlay) fechar()
  })

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      fechar()
      document.removeEventListener('keydown', onKeyDown)
    }
  }
  document.addEventListener('keydown', onKeyDown)
}

if (typeof window !== 'undefined') {
  window.addEventListener('natflow:abrir-changelog', (e: Event) => {
    const custom = e as CustomEvent<InfoVersaoPublicada>
    abrirModalChangelog(custom.detail || null)
  })
}

export async function criarHeader(container: HTMLElement, email: string): Promise<void> {
  let nomeExibicao = email.split('@')[0]
  let badgePapel = ''
  let temPix = false
  let chavePixTexto = ''
  let beneficiarioPixTexto = ''

  try {
    const perfil = await obterPerfilAtual()
    if (perfil) {
      nomeExibicao = perfil.nome
      temPix = Boolean(perfil.chave_pix)
      chavePixTexto = perfil.chave_pix || ''
      beneficiarioPixTexto = perfil.beneficiario_pix || ''
      const ehAdmin = perfil.papel === 'admin'
      badgePapel = ehAdmin
        ? `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold uppercase border border-amber-500/30 shrink-0">Admin</span>`
        : `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase shrink-0">Membro</span>`
    }
  } catch {
    // fallback mantendo email
  }

  const tooltipPix = chavePixTexto
    ? `Chave PIX: ${escaparHTML(chavePixTexto)}${beneficiarioPixTexto ? ` (${escaparHTML(beneficiarioPixTexto)})` : ''}`
    : 'Cadastrar chave PIX'

  const badgePix = temPix
    ? `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-500/30 shrink-0" title="${tooltipPix}">🔑 PIX</span>`
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
              <button id="btn-versao-changelog" type="button" class="group text-[9px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-black shrink-0 cursor-pointer transition flex items-center gap-1 shadow-sm" title="Ver novidades e o que mudou na versão v${__BUILD_VERSION__}">
                <span>v${__BUILD_VERSION__}</span>
                <span class="text-[8px] opacity-75 group-hover:opacity-100 group-hover:rotate-12 transition">✨</span>
              </button>
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
        <a href="#/financeiro" data-nav class="flex-1 sm:flex-none text-center text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0">
          📊 <span class="hidden sm:inline">Resumo Financeiro</span><span class="sm:hidden">Financeiro</span>
        </a>
        <a href="#/" data-nav class="flex-1 sm:flex-none text-center text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0">
          👥 Clientes
        </a>
        <a href="#/historico" data-nav class="flex-1 sm:flex-none text-center text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0">
          📜 <span class="hidden sm:inline">Histórico de Alterações</span><span class="sm:hidden">Histórico</span>
        </a>
        <a href="#/equipe" data-nav class="flex-1 sm:flex-none text-center text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0">
          👥🔑 <span class="hidden sm:inline">Equipe & Permissões</span><span class="sm:hidden">Equipe</span>
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

  container.querySelector('#btn-versao-changelog')?.addEventListener('click', () => {
    abrirModalChangelog()
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
