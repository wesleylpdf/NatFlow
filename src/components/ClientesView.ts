import { abrirFormModal, confirmar } from '@/components/Modal'
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientesComSaldo,
} from '@/services/clientes'
import type { ClienteComSaldo } from '@/types'
import { escaparHTML, formatarAutoriaResumida, formatarMoeda, formatarTelefone } from '@/utils/format'
import { toast, mensagemErro } from '@/utils/toast'
import { cls, erroHTML, loadingHTML } from '@/utils/ui'

function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function badgeSaldo(saldo: number): string {
  if (saldo > 0) {
    return `<span class="text-xs font-black px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20 whitespace-nowrap">Deve ${formatarMoeda(saldo)}</span>`
  }
  if (saldo < 0) {
    return `<span class="text-xs font-black px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20 whitespace-nowrap">Crédito ${formatarMoeda(-saldo)}</span>`
  }
  return `<span class="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 whitespace-nowrap">Em dia</span>`
}

/**
 * Tela inicial: cadastro e lista de clientes com saldo devedor e sanfona/accordion.
 */
export async function renderClientes(container: HTMLElement): Promise<void> {
  container.innerHTML = loadingHTML()

  let clientes: ClienteComSaldo[]
  try {
    clientes = await listarClientesComSaldo()
  } catch (e) {
    container.innerHTML = erroHTML(escaparHTML(mensagemErro(e, 'Erro ao carregar clientes')))
    return
  }

  let busca = ''

  const recarregar = async (): Promise<void> => {
    try {
      clientes = await listarClientesComSaldo()
      renderLista()
      renderResumo()
      const contador = container.querySelector('#contador-clientes')
      if (contador) contador.textContent = `(${clientes.length})`
    } catch (e) {
      toast.error(mensagemErro(e, 'Erro ao atualizar clientes'))
    }
  }

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">
      <section id="resumo-geral" class="relative overflow-hidden bg-white/95 text-slate-900 border border-slate-200/90 shadow-md dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 dark:text-white dark:border-slate-800 p-4 sm:p-5 rounded-3xl"></section>

      <!-- Sanfona: Cadastrar Cliente -->
      <section class="${cls.card} p-4 sm:p-5">
        <button id="btn-toggle-cadastro" type="button" class="w-full flex items-center justify-between font-black text-base text-slate-900 dark:text-white group focus:outline-none">
          <span class="flex items-center gap-2">➕ Cadastrar cliente</span>
          <span id="seta-cadastro" class="text-xs text-slate-400 group-hover:text-emerald-500 transition-transform">▼</span>
        </button>
        <div id="corpo-cadastro" class="hidden mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
          <form id="form-cliente" novalidate class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5">
            <input id="cliente-nome" type="text" class="${cls.input}" placeholder="Nome do cliente" autocomplete="off" maxlength="120">
            <input id="cliente-telefone" type="tel" inputmode="tel" class="${cls.input}" placeholder="Telefone (opcional)" autocomplete="off">
            <button type="submit" class="${cls.btnPrimario}">Cadastrar</button>
          </form>
        </div>
      </section>

      <!-- Sanfona: Lista de Clientes -->
      <section class="${cls.card} p-4 sm:p-5">
        <button id="btn-toggle-clientes" type="button" class="w-full flex items-center justify-between font-black text-base text-slate-900 dark:text-white group focus:outline-none">
          <span class="flex items-center gap-2">👥 Clientes <span id="contador-clientes" class="text-xs font-bold text-slate-400">(${clientes.length})</span></span>
          <span id="seta-clientes" class="text-xs text-slate-400 group-hover:text-emerald-500 transition-transform">▼</span>
        </button>
        <div id="corpo-clientes" class="hidden mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
          <div class="mb-3">
            <input id="busca-cliente" type="search" class="${cls.input}" placeholder="🔍 Buscar cliente por nome ou telefone">
          </div>
          <ul id="lista-clientes" class="space-y-2"></ul>
        </div>
      </section>
    </div>
  `

  const resumoEl = container.querySelector<HTMLElement>('#resumo-geral')!
  const listaEl = container.querySelector<HTMLElement>('#lista-clientes')!
  const form = container.querySelector<HTMLFormElement>('#form-cliente')!
  const nomeInput = container.querySelector<HTMLInputElement>('#cliente-nome')!
  const telInput = container.querySelector<HTMLInputElement>('#cliente-telefone')!
  const buscaInput = container.querySelector<HTMLInputElement>('#busca-cliente')!

  const btnToggleCadastro = container.querySelector<HTMLButtonElement>('#btn-toggle-cadastro')!
  const corpoCadastro = container.querySelector<HTMLElement>('#corpo-cadastro')!
  const setaCadastro = container.querySelector<HTMLElement>('#seta-cadastro')!

  const btnToggleClientes = container.querySelector<HTMLButtonElement>('#btn-toggle-clientes')!
  const corpoClientes = container.querySelector<HTMLElement>('#corpo-clientes')!
  const setaClientes = container.querySelector<HTMLElement>('#seta-clientes')!

  // Toggle do acordeão: Cadastrar
  btnToggleCadastro.addEventListener('click', () => {
    const fechado = corpoCadastro.classList.toggle('hidden')
    setaCadastro.textContent = fechado ? '▼' : '▲'
    if (!fechado) {
      nomeInput.focus()
    }
  })

  // Toggle do acordeão: Clientes
  btnToggleClientes.addEventListener('click', () => {
    const fechado = corpoClientes.classList.toggle('hidden')
    setaClientes.textContent = fechado ? '▼' : '▲'
    if (!fechado) {
      buscaInput.focus()
    }
  })

  function renderResumo(): void {
    const aReceber = clientes.reduce((acc, c) => acc + (c.saldo_devedor > 0 ? c.saldo_devedor : 0), 0)
    const devedores = clientes.filter(c => c.saldo_devedor > 0).length
    resumoEl.innerHTML = `
      <span class="block text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest mb-2">Resumo geral</span>
      <div class="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div class="bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-300 uppercase font-extrabold tracking-wide">Clientes</span>
          <span class="text-lg font-black">${clientes.length}</span>
          <span class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold"> • ${devedores} com débito</span>
        </div>
        <div class="bg-rose-50/80 border border-rose-200 dark:bg-white/5 dark:border-rose-500/20 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] sm:text-[11px] text-rose-700 dark:text-rose-300 uppercase font-extrabold tracking-wide">Total a receber</span>
          <span class="text-lg font-black text-rose-600 dark:text-rose-400">${formatarMoeda(aReceber)}</span>
        </div>
      </div>
    `
  }

  function renderLista(): void {
    const termo = normalizarBusca(busca.trim())
    const termoDigitos = busca.replace(/\D/g, '')
    const filtrados = clientes.filter(c => {
      if (!termo) return true
      return (
        normalizarBusca(c.nome).includes(termo) ||
        (termoDigitos.length > 0 && c.telefone.replace(/\D/g, '').includes(termoDigitos))
      )
    })

    if (clientes.length === 0) {
      listaEl.innerHTML = `
        <li class="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          <p class="text-3xl mb-2">🌿</p>
          Nenhum cliente cadastrado ainda. Clique em Cadastrar cliente acima!
        </li>`
      return
    }
    if (filtrados.length === 0) {
      listaEl.innerHTML = `<li class="text-center py-6 text-sm text-slate-500 dark:text-slate-400">Nenhum cliente encontrado.</li>`
      return
    }

    listaEl.innerHTML = filtrados
      .map(
        c => `
        <li class="group flex items-center gap-2 bg-slate-50 hover:bg-emerald-50/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl pl-3 pr-1.5 py-2">
          <a href="#/cliente/${c.id}" class="flex-1 min-w-0 flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-sm shrink-0">
              ${escaparHTML(c.nome.trim().charAt(0).toUpperCase())}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-bold text-sm text-slate-900 dark:text-white truncate">${escaparHTML(c.nome)}</p>
              <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                <span>${c.telefone ? escaparHTML(c.telefone) : 'Sem telefone'}</span>
                <span>•</span>
                <span class="text-[11px] text-slate-400 dark:text-slate-500">${formatarAutoriaResumida(c)}</span>
              </div>
            </div>
            ${badgeSaldo(c.saldo_devedor)}
          </a>
          <button data-editar="${c.id}" class="${cls.btnIcone}" title="Editar cliente">✏️</button>
          <button data-excluir="${c.id}" class="${cls.btnIcone}" title="Excluir cliente">🗑️</button>
        </li>`
      )
      .join('')
  }

  telInput.addEventListener('input', () => {
    telInput.value = formatarTelefone(telInput.value)
  })

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const nome = nomeInput.value.trim()
    if (!nome) {
      toast.warning('Informe o nome do cliente')
      nomeInput.focus()
      return
    }
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    btn.disabled = true
    try {
      await criarCliente({ nome, telefone: telInput.value })
      toast.success('Cliente cadastrado com sucesso!')
      form.reset()
      // Recolhe a sanfona após o cadastro com sucesso
      corpoCadastro.classList.add('hidden')
      setaCadastro.textContent = '▼'
      await recarregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao cadastrar cliente'))
    } finally {
      btn.disabled = false
    }
  })

  buscaInput.addEventListener('input', () => {
    busca = buscaInput.value
    renderLista()
  })

  listaEl.addEventListener('click', async e => {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-editar],[data-excluir]')
    if (!alvo) return
    e.preventDefault()

    const id = alvo.dataset.editar ?? alvo.dataset.excluir!
    const cliente = clientes.find(c => c.id === id)
    if (!cliente) return

    if (alvo.dataset.editar) {
      abrirEdicaoCliente(cliente, recarregar)
      return
    }

    const ok = await confirmar({
      titulo: 'Excluir cliente',
      mensagem: `Excluir <strong>${escaparHTML(cliente.nome)}</strong>? Todos os produtos e pagamentos deste cliente também serão excluídos. Esta ação não pode ser desfeita.`,
    })
    if (!ok) return
    try {
      await excluirCliente(id)
      toast.success('Cliente excluído')
      await recarregar()
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao excluir cliente'))
    }
  })

  renderResumo()
  renderLista()
}

/** Abre o modal de edição de cliente (usado na lista e na tela do cliente). */
export function abrirEdicaoCliente(
  cliente: { id: string; nome: string; telefone: string },
  aoSalvar: () => void | Promise<void>
): void {
  abrirFormModal({
    titulo: 'Editar cliente',
    campos: [
      { nome: 'nome', label: 'Nome', tipo: 'text', valor: cliente.nome, obrigatorio: true },
      { nome: 'telefone', label: 'Telefone', tipo: 'tel', valor: cliente.telefone, placeholder: '(00) 00000-0000' },
    ],
    onSalvar: async v => {
      await atualizarCliente(cliente.id, { nome: v.nome, telefone: v.telefone })
      toast.success('Cliente atualizado!')
      await aoSalvar()
    },
  })
}
