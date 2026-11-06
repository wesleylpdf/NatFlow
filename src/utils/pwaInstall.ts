interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

let promptDeferred: BeforeInstallPromptEvent | null = null
const ouvintes: ((disponivel: boolean) => void)[] = []

/**
 * Verifica se a aplicação já está rodando como PWA instalado (Standalone)
 */
export function estaInstalado(): boolean {
  if (typeof window === 'undefined') return false
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  return Boolean(standaloneMedia || iosStandalone)
}

/**
 * Verifica se é dispositivo Apple (iOS / iPadOS / macOS Safari)
 */
export function ehDispositivoApple(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Captura o evento de instalação do PWA
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    promptDeferred = e as BeforeInstallPromptEvent
    notificarOuvintes(true)
  })

  window.addEventListener('appinstalled', () => {
    promptDeferred = null
    notificarOuvintes(false)
  })
}

function notificarOuvintes(disponivel: boolean): void {
  ouvintes.forEach(cb => {
    try {
      cb(disponivel)
    } catch {
      // ignora
    }
  })
}

/**
 * Registra callback para ser avisado se o botão de instalar deve aparecer ou não
 */
export function onDisponibilidadeInstalacao(cb: (disponivel: boolean) => void): () => void {
  ouvintes.push(cb)

  if (estaInstalado()) {
    cb(false)
  } else if (promptDeferred) {
    cb(true)
  } else if (ehDispositivoApple() && !estaInstalado()) {
    // No Safari iOS não existe beforeinstallprompt, mas podemos orientar o usuário
    cb(true)
  } else {
    cb(false)
  }

  return () => {
    const idx = ouvintes.indexOf(cb)
    if (idx >= 0) ouvintes.splice(idx, 1)
  }
}

/**
 * Executa o prompt nativo de instalação ou orienta no iOS
 */
export async function acionarInstalacaoPWA(): Promise<'instalado' | 'dispensado' | 'instrucoes_ios' | 'indisponivel'> {
  if (estaInstalado()) {
    return 'instalado'
  }

  if (promptDeferred) {
    try {
      await promptDeferred.prompt()
      const { outcome } = await promptDeferred.userChoice
      promptDeferred = null
      notificarOuvintes(false)
      return outcome === 'accepted' ? 'instalado' : 'dispensado'
    } catch (err) {
      console.warn('[PWA] Erro ao disparar prompt de instalação:', err)
      return 'indisponivel'
    }
  }

  if (ehDispositivoApple()) {
    return 'instrucoes_ios'
  }

  return 'indisponivel'
}
