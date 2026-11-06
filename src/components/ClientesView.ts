import { abrirFormModal, confirmar } from '@/components/Modal'
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientesComSaldo,
} from '@/services/clientes'
import { obterResumoFinanceiro } from '@/services/financeiro'
import type { ClienteComSaldo, ResumoFinanceiro } from '@/types'
import {
  escaparHTML,
  formatarAutoriaResumida,
  formatarMesAno,
  formatarMoeda,
  formatarTelefone,
} from '@/utils/format'
import { toast, mensagemErro } from '@/utils/toast'
import { cls, erroHTML, loadingHTML } from '@/utils/ui'

type FiltroStatus = 'todos' | 'devedores' | 'em_dia'

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
 * Tela inicial: resumo financeiro por período, cadastro e lista de clientes com filtros rápidos.
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

  // Controle de período financeiro
  const dataHoje = new Date()
  let periodoTipo: 'mes' | 'tudo' = 'mes'
  let periodoAno = dataHoje.getFullYear()
  let periodoMes = dataHoje.getMonth() + 1 // 1 a 12

  let resumoFin: ResumoFinanceiro = {
    totalRecebido: 0,
    totalVendido: 0,
    saldoPeriodo: 0,
    porFormaPagamento: { pix: 0, dinheiro: 0, credito: 0, debito: 0, outro: 0 },
    quantidadePagamentos: 0,
    quantidadeVendas: 0,
  }

  let busca = ''
  let filtroStatus: FiltroStatus = 'todos'

  async function atualizarResumoFinanceiro(): Promise<void> {
    try {
      resumoFin = await obterResumoFinanceiro(
        periodoTipo === 'tudo'
          ? { tudo: true }
          : { ano: periodoAno, mes: periodoMes }
      )
      renderResumo()
    } catch (e) {
      console.warn('Erro ao obter resumo financeiro:', e)
    }
  }

  const recarregar = async (): Promise<void> => {
    try {
      clientes = await listarClientesComSaldo()
      renderLista()
      await atualizarResumoFinanceiro()
      const contador = container.querySelector('#contador-clientes')
      if (contador) contador.textContent = `(${clientes.length})`
    } catch (e) {
      toast.error(mensagemErro(e, 'Erro ao atualizar clientes'))
    }
  }

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">
      <section id="resumo-geral" class="relative overflow-hidden bg-white/95 text-slate-900 border border-slate-200/90 shadow-md dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 dark:text-white dark:border-slate-800 p-4 sm:p-5 rounded-3xl space-y-3.5"></section>

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
          <!-- Filtros Rápidos -->
          <div class="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-3 text-xs font-bold" role="group" aria-label="Filtrar por status">
            <button type="button" data-filtro="todos" class="btn-filtro py-2 px-1 rounded-xl transition text-center">
              ⚪ Todos <span id="filtro-count-todos" class="opacity-75 font-semibold text-[11px]"></span>
            </button>
            <button type="button" data-filtro="devedores" class="btn-filtro py-2 px-1 rounded-xl transition text-center">
              🔴 Com Débito <span id="filtro-count-devedores" class="opacity-75 font-semibold text-[11px]"></span>
            </button>
            <button type="button" data-filtro="em_dia" class="btn-filtro py-2 px-1 rounded-xl transition text-center">
              🟢 Em Dia <span id="filtro-count-emdia" class="opacity-75 font-semibold text-[11px]"></span>
            </button>
          </div>

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

  // Botões de filtro rápido da lista
  container.querySelectorAll<HTMLButtonElement>('.btn-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filtro as FiltroStatus
      if (f && f !== filtroStatus) {
        filtroStatus = f
        renderLista()
      }
    })
  })

  function renderResumo(): void {
    const aReceberGeral = clientes.reduce((acc, c) => acc + (c.saldo_devedor > 0 ? c.saldo_devedor : 0), 0)
    const devedoresGeral = clientes.filter(c => c.saldo_devedor > 0).length

    const rotuloPeriodo =
      periodoTipo === 'tudo'
        ? 'Todo o Período'
        : formatarMesAno(periodoAno, periodoMes)

    const ehMesAtual =
      periodoTipo === 'mes' &&
      periodoAno === dataHoje.getFullYear() &&
      periodoMes === dataHoje.getMonth() + 1

    const dataMesAnterior = new Date(dataHoje.getFullYear(), dataHoje.getMonth() - 1, 1)
    const ehMesAnterior =
      periodoTipo === 'mes' &&
      periodoAno === dataMesAnterior.getFullYear() &&
      periodoMes === dataMesAnterior.getMonth() + 1

    const corSaldoPeriodo =
      resumoFin.saldoPeriodo > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : resumoFin.saldoPeriodo < 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-slate-900 dark:text-white'

    resumoEl.innerHTML = `
      <!-- Cabeçalho do Resumo com Navegação de Período -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-white/10">
        <div class="flex items-center justify-between sm:justify-start gap-2">
          <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-widest">Resumo Financeiro</span>
          <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/10 rounded-xl px-1.5 py-0.5">
            <button id="btn-mes-anterior" type="button" class="px-2 py-0.5 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-emerald-500 rounded-lg transition" title="Mês anterior">◀</button>
            <span id="rotulo-mes-ano" class="text-xs font-black text-slate-900 dark:text-white px-1 whitespace-nowrap">${escaparHTML(rotuloPeriodo)}</span>
            <button id="btn-mes-proximo" type="button" class="px-2 py-0.5 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-emerald-500 rounded-lg transition" title="Próximo mês">▶</button>
          </div>
        </div>

        <div class="flex items-center gap-1 text-[11px] font-bold" role="group">
          <button id="btn-p-atual" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition ${
            ehMesAtual
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">Este Mês</button>
          <button id="btn-p-anterior" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition ${
            ehMesAnterior
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">Mês Anterior</button>
          <button id="btn-p-tudo" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition ${
            periodoTipo === 'tudo'
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">Geral</button>
        </div>
      </div>

      <!-- 4 Cards Principais de Indicadores -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-black tracking-wide">📥 Entradas</span>
          <span class="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 truncate block">${formatarMoeda(resumoFin.totalRecebido)}</span>
          <span class="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-semibold">${resumoFin.quantidadePagamentos} pagamentos</span>
        </div>

        <div class="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] text-rose-700 dark:text-rose-300 uppercase font-black tracking-wide">🛍️ Vendas</span>
          <span class="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300 truncate block">${formatarMoeda(resumoFin.totalVendido)}</span>
          <span class="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-semibold">${resumoFin.quantidadeVendas} produtos</span>
        </div>

        <div class="bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] text-slate-500 dark:text-slate-300 uppercase font-black tracking-wide">⚖️ Balanço</span>
          <span class="text-base sm:text-lg font-black ${corSaldoPeriodo} truncate block">${formatarMoeda(resumoFin.saldoPeriodo)}</span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">Entradas − Vendas</span>
        </div>

        <div class="bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] text-slate-500 dark:text-slate-300 uppercase font-black tracking-wide">👥 A Receber</span>
          <span class="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate block">${formatarMoeda(aReceberGeral)}</span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">${devedoresGeral} com débito</span>
        </div>
      </div>

      <!-- Detalhamento de Entradas por Forma de Pagamento -->
      <div class="bg-slate-50/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-2xl p-2.5 sm:p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
            💳 Entradas por Forma de Pagamento
          </span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
            ${escaparHTML(rotuloPeriodo)}
          </span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2">
            <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">💠 PIX</span>
            <span class="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 block truncate">${formatarMoeda(resumoFin.porFormaPagamento.pix || 0)}</span>
          </div>
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2">
            <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">💵 Dinheiro</span>
            <span class="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 block truncate">${formatarMoeda(resumoFin.porFormaPagamento.dinheiro || 0)}</span>
          </div>
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2">
            <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">💳 Crédito</span>
            <span class="text-xs sm:text-sm font-black text-sky-600 dark:text-sky-400 block truncate">${formatarMoeda(resumoFin.porFormaPagamento.credito || 0)}</span>
          </div>
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2">
            <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">💳 Débito</span>
            <span class="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 block truncate">${formatarMoeda(resumoFin.porFormaPagamento.debito || 0)}</span>
          </div>
        </div>
      </div>
    `

    // Eventos dos controles de período
    resumoEl.querySelector('#btn-mes-anterior')?.addEventListener('click', async () => {
      periodoTipo = 'mes'
      if (periodoMes === 1) {
        periodoMes = 12
        periodoAno--
      } else {
        periodoMes--
      }
      await atualizarResumoFinanceiro()
    })

    resumoEl.querySelector('#btn-mes-proximo')?.addEventListener('click', async () => {
      periodoTipo = 'mes'
      if (periodoMes === 12) {
        periodoMes = 1
        periodoAno++
      } else {
        periodoMes++
      }
      await atualizarResumoFinanceiro()
    })

    resumoEl.querySelector('#btn-p-atual')?.addEventListener('click', async () => {
      periodoTipo = 'mes'
      periodoAno = dataHoje.getFullYear()
      periodoMes = dataHoje.getMonth() + 1
      await atualizarResumoFinanceiro()
    })

    resumoEl.querySelector('#btn-p-anterior')?.addEventListener('click', async () => {
      periodoTipo = 'mes'
      const ant = new Date(dataHoje.getFullYear(), dataHoje.getMonth() - 1, 1)
      periodoAno = ant.getFullYear()
      periodoMes = ant.getMonth() + 1
      await atualizarResumoFinanceiro()
    })

    resumoEl.querySelector('#btn-p-tudo')?.addEventListener('click', async () => {
      periodoTipo = 'tudo'
      await atualizarResumoFinanceiro()
    })
  }

  function renderLista(): void {
    const totalTodos = clientes.length
    const totalDevedores = clientes.filter(c => c.saldo_devedor > 0).length
    const totalEmDia = clientes.filter(c => c.saldo_devedor <= 0).length

    const countTodos = container.querySelector('#filtro-count-todos')
    const countDevedores = container.querySelector('#filtro-count-devedores')
    const countEmDia = container.querySelector('#filtro-count-emdia')
    if (countTodos) countTodos.textContent = `(${totalTodos})`
    if (countDevedores) countDevedores.textContent = `(${totalDevedores})`
    if (countEmDia) countEmDia.textContent = `(${totalEmDia})`

    // Estilização do filtro ativo vs inativo
    container.querySelectorAll<HTMLButtonElement>('.btn-filtro').forEach(btn => {
      const f = btn.dataset.filtro
      if (f === filtroStatus) {
        btn.className = 'btn-filtro py-2 px-1 rounded-xl transition text-center bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white font-black ring-1 ring-slate-200 dark:ring-slate-700'
      } else {
        btn.className = 'btn-filtro py-2 px-1 rounded-xl transition text-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
      }
    })

    const termo = normalizarBusca(busca.trim())
    const termoDigitos = busca.replace(/\D/g, '')

    const filtrados = clientes.filter(c => {
      // Regra do filtro rápido
      if (filtroStatus === 'devedores' && c.saldo_devedor <= 0) return false
      if (filtroStatus === 'em_dia' && c.saldo_devedor > 0) return false

      // Regra da busca
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
      let mensagemVazia = 'Nenhum cliente encontrado.'
      if (termo) {
        mensagemVazia = 'Nenhum cliente encontrado para a busca digitada.'
      } else if (filtroStatus === 'devedores') {
        mensagemVazia = '🎉 Que ótimo! Nenhum cliente com débito pendente no momento.'
      } else if (filtroStatus === 'em_dia') {
        mensagemVazia = 'Nenhum cliente com pagamentos em dia encontrado.'
      }

      listaEl.innerHTML = `<li class="text-center py-6 text-sm text-slate-500 dark:text-slate-400 font-medium">${escaparHTML(mensagemVazia)}</li>`
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
  await atualizarResumoFinanceiro()
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
