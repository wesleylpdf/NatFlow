import { cls } from '@/utils/ui'
import { escaparHTML, formatarTelefone } from '@/utils/format'
import { mensagemErro } from '@/utils/toast'

export type TipoCampo = 'text' | 'date' | 'valor' | 'tel' | 'password' | 'select'

export interface OpcaoSelect {
  valor: string
  label: string
}

export interface CampoModal {
  nome: string
  label: string
  tipo: TipoCampo
  valor?: string
  placeholder?: string
  obrigatorio?: boolean
  opcoes?: OpcaoSelect[]
}

interface FormModalOpcoes {
  titulo: string
  campos: CampoModal[]
  textoConfirmar?: string
  /** Lança erro para manter o modal aberto e exibir a mensagem. */
  onSalvar: (valores: Record<string, string>) => Promise<void>
}

function criarOverlay(conteudo: string): HTMLDivElement {
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-fade-in'
  overlay.innerHTML = `
    <div class="modal-content ${cls.card} w-full max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
      ${conteudo}
    </div>
  `
  document.body.appendChild(overlay)
  return overlay
}

function tipoInput(tipo: TipoCampo): string {
  if (tipo === 'valor') return 'type="text" inputmode="decimal"'
  if (tipo === 'tel') return 'type="tel" inputmode="tel"'
  return `type="${tipo}"`
}

/**
 * Abre um modal com formulário. Retorna quando o modal é fechado.
 */
export function abrirFormModal(opcoes: FormModalOpcoes): void {
  const camposHTML = opcoes.campos
    .map(c => {
      if (c.tipo === 'select') {
        const optionsHTML = (c.opcoes || [])
          .map(
            opt =>
              `<option value="${escaparHTML(opt.valor)}" ${opt.valor === c.valor ? 'selected' : ''}>${escaparHTML(opt.label)}</option>`
          )
          .join('')
        return `
          <div>
            <label class="${cls.label}" for="modal-${c.nome}">${escaparHTML(c.label)}${c.obrigatorio ? ' *' : ''}</label>
            <select id="modal-${c.nome}" name="${c.nome}" class="${cls.input} font-semibold">
              ${optionsHTML}
            </select>
          </div>`
      }

      return `
        <div>
          <label class="${cls.label}" for="modal-${c.nome}">${escaparHTML(c.label)}${c.obrigatorio ? ' *' : ''}</label>
          <input id="modal-${c.nome}" name="${c.nome}" ${tipoInput(c.tipo)}
            class="${cls.input}" value="${escaparHTML(c.valor ?? '')}"
            placeholder="${escaparHTML(c.placeholder ?? '')}" ${c.obrigatorio ? 'required' : ''} autocomplete="off">
        </div>`
    })
    .join('')

  const overlay = criarOverlay(`
    <form novalidate>
      <h3 class="font-black text-lg text-slate-900 dark:text-white mb-4">${escaparHTML(opcoes.titulo)}</h3>
      <div class="space-y-3">${camposHTML}</div>
      <p data-erro class="hidden mt-3 text-xs font-semibold text-rose-500"></p>
      <div class="flex gap-2 justify-end mt-5">
        <button type="button" data-cancelar class="${cls.btnSecundario}">Cancelar</button>
        <button type="submit" data-salvar class="${cls.btnPrimario}">${escaparHTML(opcoes.textoConfirmar ?? 'Salvar')}</button>
      </div>
    </form>
  `)

  const form = overlay.querySelector('form')!
  const erroEl = overlay.querySelector<HTMLElement>('[data-erro]')!
  const btnSalvar = overlay.querySelector<HTMLButtonElement>('[data-salvar]')!

  const fechar = (): void => {
    document.removeEventListener('keydown', onKey)
    overlay.remove()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') fechar()
  }
  document.addEventListener('keydown', onKey)

  overlay.addEventListener('mousedown', e => {
    if (e.target === overlay) fechar()
  })
  overlay.querySelector('[data-cancelar]')!.addEventListener('click', fechar)

  // Máscara de telefone nos campos tel
  overlay.querySelectorAll<HTMLInputElement>('input[type="tel"]').forEach(input => {
    input.addEventListener('input', () => {
      input.value = formatarTelefone(input.value)
    })
  })

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const valores: Record<string, string> = {}
    opcoes.campos.forEach(c => {
      valores[c.nome] = (form.elements.namedItem(c.nome) as HTMLInputElement).value
    })

    const faltando = opcoes.campos.find(c => c.obrigatorio && !valores[c.nome].trim())
    if (faltando) {
      erroEl.textContent = `Preencha o campo "${faltando.label}"`
      erroEl.classList.remove('hidden')
      return
    }

    btnSalvar.disabled = true
    const textoOriginal = btnSalvar.textContent
    btnSalvar.textContent = 'Salvando...'
    try {
      await opcoes.onSalvar(valores)
      fechar()
    } catch (err) {
      erroEl.textContent = mensagemErro(err, 'Erro ao salvar')
      erroEl.classList.remove('hidden')
      btnSalvar.disabled = false
      btnSalvar.textContent = textoOriginal
    }
  })

  overlay.querySelector<HTMLInputElement>('input')?.focus()
}

/**
 * Modal de confirmação. Resolve `true` se o usuário confirmar.
 */
export function confirmar(opcoes: {
  titulo: string
  mensagem: string
  textoConfirmar?: string
}): Promise<boolean> {
  return new Promise(resolve => {
    const overlay = criarOverlay(`
      <h3 class="font-black text-lg text-slate-900 dark:text-white mb-2">${escaparHTML(opcoes.titulo)}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300 mb-5">${opcoes.mensagem}</p>
      <div class="flex gap-2 justify-end">
        <button type="button" data-cancelar class="${cls.btnSecundario}">Cancelar</button>
        <button type="button" data-confirmar class="${cls.btnPerigo}">${escaparHTML(opcoes.textoConfirmar ?? 'Excluir')}</button>
      </div>
    `)

    const finalizar = (resultado: boolean): void => {
      document.removeEventListener('keydown', onKey)
      overlay.remove()
      resolve(resultado)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') finalizar(false)
    }
    document.addEventListener('keydown', onKey)

    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) finalizar(false)
    })
    overlay.querySelector('[data-cancelar]')!.addEventListener('click', () => finalizar(false))
    const btnConfirmar = overlay.querySelector<HTMLButtonElement>('[data-confirmar]')!
    btnConfirmar.addEventListener('click', () => finalizar(true))
    btnConfirmar.focus()
  })
}
