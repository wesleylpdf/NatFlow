import { toast } from '@/utils/toast'
import type { ItemChangelog } from '@/data/changelog'

// Intervalo de verificação em segundo plano: a cada 30 segundos
const INTERVALO_VERIFICACAO_MS = 30 * 1000
const CHAVE_ULTIMA_VERSAO_VISTA = 'natflow_ultima_versao'
const CHAVE_VERSAO_ATUALIZADA_FLAG = 'natflow_atualizado_flag'
const BASE_URL = import.meta.env.BASE_URL || '/'
const URL_VERSAO = `${BASE_URL}version.json`

export interface InfoVersaoPublicada {
  version: string
  builtAt?: string
  changelog?: ItemChangelog[]
}

let recarregando = false
let ultimaVerificacao = 0
let bannerAtivoEl: HTMLElement | null = null
let dadosUltimaVersaoPublicada: InfoVersaoPublicada | null = null

export function obterDadosUltimaVersaoPublicada(): InfoVersaoPublicada | null {
  return dadosUltimaVersaoPublicada
}

export async function buscarVersaoPublicada(): Promise<InfoVersaoPublicada | null> {
  try {
    const resposta = await fetch(`${URL_VERSAO}?_=${Date.now()}`, { cache: 'no-store' })
    if (!resposta.ok) return null
    const dados = (await resposta.json()) as InfoVersaoPublicada
    if (dados && dados.version) {
      dadosUltimaVersaoPublicada = dados
      return dados
    }
    return null
  } catch {
    // Falha momentânea de rede: tenta na próxima verificação
    return null
  }
}

export function recarregarIgnorandoCache(versao: string): void {
  if (recarregando) return
  recarregando = true

  try {
    localStorage.setItem(CHAVE_VERSAO_ATUALIZADA_FLAG, versao)
  } catch {
    // Ignora
  }

  // Preserva a rota/hash atual onde o usuário estava forçando atualização sem cache
  const url = new URL(window.location.href)
  url.searchParams.set('v', versao)
  url.searchParams.set('_t', String(Date.now()))
  window.location.replace(url.toString())
}

/**
 * Exibe um banner/card destacado de notificação de nova versão no topo da tela.
 */
export function exibirNotificacaoNovaVersao(info: string | InfoVersaoPublicada, simular = false): void {
  const versaoString = typeof info === 'string' ? info : info.version
  const infoObj: InfoVersaoPublicada = typeof info === 'string' ? { version: info } : info

  if (bannerAtivoEl && document.body.contains(bannerAtivoEl)) {
    bannerAtivoEl.remove()
  }

  const banner = document.createElement('div')
  banner.id = 'banner-atualizacao-disponivel'
  banner.className =
    'fixed top-3 left-1/2 -translate-x-1/2 z-[10002] w-[94%] max-w-md bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-white/20 animate-slide-in backdrop-blur-md'

  banner.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner">
        🚀
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1">
          <h4 class="text-xs sm:text-sm font-black text-white tracking-wide flex items-center gap-1.5">
            <span>Nova Versão do NatFlow</span>
            <span class="text-[10px] bg-white/25 px-1.5 py-0.5 rounded-full font-black">v${versaoString}</span>
          </h4>
          <button type="button" id="btn-fechar-banner-att" class="text-white/80 hover:text-white text-base leading-none p-1 rounded-lg hover:bg-white/10 transition" title="Fechar">✕</button>
        </div>
        <p class="text-[11px] sm:text-xs text-emerald-100 font-medium mt-0.5 leading-snug">
          ${simular ? '🧪 [Teste de notificação] Nova atualização pronta para instalar!' : 'Uma atualização acabou de ser publicada com novas melhorias e correções.'}
        </p>
        <div class="flex items-center gap-2 mt-2.5">
          <button type="button" id="btn-aplicar-atualizacao" class="flex-1 text-xs font-black py-1.5 px-3 bg-white text-emerald-900 rounded-xl hover:bg-emerald-50 active:scale-95 transition shadow-sm flex items-center justify-center gap-1 cursor-pointer">
            <span>🔄</span> Atualizar Agora
          </button>
          <button type="button" id="btn-ver-novidades-banner" class="text-xs font-extrabold py-1.5 px-3 bg-white/15 hover:bg-white/25 text-white rounded-xl active:scale-95 transition flex items-center justify-center gap-1 cursor-pointer">
            <span>✨</span> Novidades
          </button>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(banner)
  bannerAtivoEl = banner

  banner.querySelector('#btn-fechar-banner-att')?.addEventListener('click', () => {
    banner.classList.add('animate-slide-out')
    setTimeout(() => banner.remove(), 300)
    bannerAtivoEl = null
  })

  banner.querySelector('#btn-aplicar-atualizacao')?.addEventListener('click', () => {
    if (simular) {
      toast.success('Simulação de atualização concluída com sucesso!')
      banner.remove()
      bannerAtivoEl = null
    } else {
      recarregarIgnorandoCache(versaoString)
    }
  })

  banner.querySelector('#btn-ver-novidades-banner')?.addEventListener('click', () => {
    banner.remove()
    bannerAtivoEl = null
    window.dispatchEvent(
      new CustomEvent('natflow:abrir-changelog', {
        detail: infoObj,
      })
    )
  })
}

/**
 * Dispara um teste visual da notificação para o usuário testar e comprovar o funcionamento.
 */
export function testarNotificacaoAtualizacao(): void {
  exibirNotificacaoNovaVersao('1.2.99 (Teste)', true)
}

/**
 * Checagem manual solicitada pelo usuário no botão dentro do modal de versão.
 */
export async function verificarAtualizacaoManual(): Promise<void> {
  toast.info('Buscando atualizações no servidor...', 2000)
  const info = await buscarVersaoPublicada()

  if (!info || !info.version) {
    toast.error('Não foi possível verificar a versão agora. Verifique sua conexão.')
    return
  }

  if (info.version !== __BUILD_VERSION__) {
    exibirNotificacaoNovaVersao(info)
  } else {
    toast.success(`Você já está na versão mais recente (v${__BUILD_VERSION__})!`, 3500)
  }
}

/**
 * Verifica se a versão no servidor é diferente da versão atualmente carregada.
 */
export async function verificarAtualizacao(ignorarThrottle = false): Promise<void> {
  if (recarregando) return

  const agora = Date.now()
  if (!ignorarThrottle && agora - ultimaVerificacao < 5000) return
  ultimaVerificacao = agora

  const info = await buscarVersaoPublicada()
  if (!info || !info.version || info.version === __BUILD_VERSION__) return

  exibirNotificacaoNovaVersao(info)
}

/**
 * Notifica suavemente o usuário após uma atualização concluída assim que a tela está pronta.
 */
export function notificarSeAtualizouNoCarregamento(): void {
  setTimeout(() => {
    try {
      const flagAtualizado = localStorage.getItem(CHAVE_VERSAO_ATUALIZADA_FLAG)
      const versaoAnterior = localStorage.getItem(CHAVE_ULTIMA_VERSAO_VISTA)
      localStorage.setItem(CHAVE_ULTIMA_VERSAO_VISTA, __BUILD_VERSION__)

      const atualizou =
        (flagAtualizado && flagAtualizado === __BUILD_VERSION__) ||
        (versaoAnterior && versaoAnterior !== __BUILD_VERSION__)

      if (atualizou) {
        localStorage.removeItem(CHAVE_VERSAO_ATUALIZADA_FLAG)
        toast.success(`✨ NatFlow atualizado com sucesso para a versão v${__BUILD_VERSION__}!`, 4500)
      }
    } catch {
      // Ignora erro de storage
    }
  }, 1000)
}

/**
 * Inicia o ciclo de verificação rápida de novas versões:
 * 1. Ao iniciar a aplicação (com atraso após carregamento do DOM)
 * 2. A cada 30 segundos
 * 3. Ao mudar de aba ou voltar o foco para a janela
 * 4. Ao navegar entre telas pelo hash (#/)
 */
export function iniciarVerificacaoDeAtualizacoes(): void {
  notificarSeAtualizouNoCarregamento()
  void verificarAtualizacao(true)

  // Quando o usuário volta para a aba
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void verificarAtualizacao(true)
    }
  })

  // Quando o usuário clica ou foca na janela do navegador
  window.addEventListener('focus', () => {
    void verificarAtualizacao(true)
  })

  // Ao navegar pelo app
  window.addEventListener('hashchange', () => {
    void verificarAtualizacao()
  })

  // Intervalo periódico em segundo plano (30 segundos)
  window.setInterval(() => {
    void verificarAtualizacao()
  }, INTERVALO_VERIFICACAO_MS)
}

// Expor no window para testes facilitados
if (typeof window !== 'undefined') {
  ;(window as unknown as { testarNotificacaoAtualizacao?: () => void }).testarNotificacaoAtualizacao =
    testarNotificacaoAtualizacao
}
