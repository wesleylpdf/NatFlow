/**
 * Sistema de notificações toast
 * Fornece feedback visual para ações do usuário
 */

type ToastType = 'success' | 'error' | 'warning' | 'info'

class ToastManager {
  private container: HTMLElement | null = null

  private createContainer(): HTMLElement {
    if (this.container && document.body.contains(this.container)) return this.container

    this.container = document.createElement('div')
    this.container.id = 'toast-container'
    this.container.className = 'fixed top-4 right-4 z-[10001] flex flex-col gap-2 pointer-events-none'
    document.body.appendChild(this.container)

    return this.container
  }

  private getIcon(type: ToastType): string {
    const icons: Record<ToastType, string> = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    }
    return icons[type]
  }

  private getStyles(type: ToastType): string {
    const styles: Record<ToastType, string> = {
      success: 'bg-emerald-500 text-white',
      error: 'bg-rose-500 text-white',
      warning: 'bg-amber-500 text-white',
      info: 'bg-sky-500 text-white',
    }
    return styles[type]
  }

  show(type: ToastType, message: string, duration = 3000): string {
    const container = this.createContainer()
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const element = document.createElement('div')
    element.id = id
    element.className = `toast ${this.getStyles(type)} px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 min-w-[250px] max-w-[400px] animate-slide-in pointer-events-auto cursor-pointer`

    const iconSpan = document.createElement('span')
    iconSpan.className = 'text-lg font-bold'
    iconSpan.textContent = this.getIcon(type)

    const messageSpan = document.createElement('span')
    messageSpan.className = 'flex-1 text-sm font-medium'
    messageSpan.textContent = message

    element.appendChild(iconSpan)
    element.appendChild(messageSpan)

    element.addEventListener('click', () => this.dismiss(id))
    container.appendChild(element)

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration)
    }

    return id
  }

  success(message: string, duration?: number): string {
    return this.show('success', message, duration)
  }

  error(message: string, duration?: number): string {
    return this.show('error', message, duration || 5000)
  }

  warning(message: string, duration?: number): string {
    return this.show('warning', message, duration)
  }

  info(message: string, duration?: number): string {
    return this.show('info', message, duration)
  }

  dismiss(id: string): void {
    const element = document.getElementById(id)
    if (!element) return

    element.classList.add('animate-slide-out')
    setTimeout(() => element.remove(), 300)
  }
}

export const toast = new ToastManager()

/** Extrai uma mensagem legível de um erro desconhecido. */
export function mensagemErro(e: unknown, padrao = 'Ocorreu um erro inesperado'): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return padrao
}
