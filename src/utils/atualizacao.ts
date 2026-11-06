import { toast } from '@/utils/toast'

// Intervalo de verificação: a cada 30 segundos
const INTERVALO_VERIFICACAO_MS = 30 * 1000
const TEMPO_EXIBICAO_TOAST_MS = 2500
const CHAVE_ULTIMA_VERSAO_VISTA = 'natflow_ultima_versao'
const BASE_URL = import.meta.env.BASE_URL || '/'
const URL_VERSAO = `${BASE_URL}version.json`

interface VersionInfo {
  version: string
  builtAt?: string
}

let recarregando = false
let ultimaVerificacao = 0

async function buscarVersaoPublicada(): Promise<string | null> {
  try {
    const resposta = await fetch(`${URL_VERSAO}?_=${Date.now()}`, { cache: 'no-store' })
    if (!resposta.ok) return null
    const dados = (await resposta.json()) as VersionInfo
    return dados.version || null
  } catch {
    // Falha momentânea de rede: tenta na próxima verificação
    return null
  }
}

function recarregarIgnorandoCache(versao: string): void {
  if (recarregando) return
  recarregando = true

  // Preserva a rota/hash atual onde o usuário estava (ex: #/equipe) forçando atualização sem cache
  const url = new URL(window.location.href)
  url.searchParams.set('v', versao)
  url.searchParams.set('_t', String(Date.now()))
  window.location.replace(url.toString())
}

/**
 * Verifica se a versão no servidor é diferente da versão atualmente carregada
 */
export async function verificarAtualizacao(ignorarThrottle = false): Promise<void> {
  if (recarregando) return

  const agora = Date.now()
  // Evita múltiplas chamadas simultâneas (mínimo 5s entre checagens se não for forçado)
  if (!ignorarThrottle && agora - ultimaVerificacao < 5000) return
  ultimaVerificacao = agora

  const versaoPublicada = await buscarVersaoPublicada()
  if (!versaoPublicada || versaoPublicada === __BUILD_VERSION__) return

  try {
    localStorage.setItem(CHAVE_ULTIMA_VERSAO_VISTA, versaoPublicada)
  } catch {
    // Ignora erro de storage
  }

  toast.info(`Nova versão disponível (${versaoPublicada}). Atualizando...`, TEMPO_EXIBICAO_TOAST_MS)
  window.setTimeout(() => recarregarIgnorandoCache(versaoPublicada), TEMPO_EXIBICAO_TOAST_MS)
}

function notificarSeAtualizouNoCarregamento(): void {
  try {
    const versaoAnterior = localStorage.getItem(CHAVE_ULTIMA_VERSAO_VISTA)
    localStorage.setItem(CHAVE_ULTIMA_VERSAO_VISTA, __BUILD_VERSION__)
    if (versaoAnterior && versaoAnterior !== __BUILD_VERSION__) {
      toast.info(`NatFlow atualizado para a versão ${__BUILD_VERSION__}!`, 3500)
    }
  } catch {
    // Ignora erro de storage
  }
}

/**
 * Inicia o ciclo de verificação rápida de novas versões:
 * 1. Ao iniciar a aplicação
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
