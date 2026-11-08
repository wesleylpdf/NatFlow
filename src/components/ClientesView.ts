import { abrirFormModal, confirmar } from '@/components/Modal'
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientesComSaldo,
} from '@/services/clientes'
import { carregarMapaMembros, obterPerfilAtual } from '@/services/equipe'
import { enviarLembreteCobrancaWhatsApp } from '@/utils/exportarPdf'
import { obterResumoFinanceiro } from '@/services/financeiro'
import type { ClienteComSaldo, ResumoFinanceiro } from '@/types'
import {
  escaparHTML,
  formatarAutoriaResumida,
  formatarData,
  formatarMesAno,
  formatarMoeda,
  formatarTelefone,
  obterStatusPromessa,
} from '@/utils/format'
import { toast, mensagemErro } from '@/utils/toast'
import { cls, erroHTML, loadingHTML } from '@/utils/ui'

type FiltroStatus = 'todos' | 'promessas' | 'devedores' | 'antigos' | 'em_dia'

function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function badgeSaldo(saldo: number, diasAtraso: number = 0): string {
  if (saldo > 0) {
    if (diasAtraso >= 60) {
      return `
        <span class="text-xs font-black px-2.5 py-1 rounded-full bg-rose-500 text-white shadow-sm whitespace-nowrap inline-flex items-center gap-1.5" title="Débito crítico pendente há mais de 60 dias sem pagamentos">
          <span class="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
          🚨 Deve ${formatarMoeda(saldo)} • +60d
        </span>`
    }
    if (diasAtraso >= 30) {
      return `
        <span class="text-xs font-black px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 shadow-sm whitespace-nowrap inline-flex items-center gap-1.5" title="Débito pendente há mais de 30 dias sem pagamentos">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-950 shrink-0"></span>
          ⏳ Deve ${formatarMoeda(saldo)} • ${diasAtraso}d
        </span>`
    }
    return `<span class="text-xs font-black px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 whitespace-nowrap">Deve ${formatarMoeda(saldo)}</span>`
  }
  if (saldo < 0) {
    return `<span class="text-xs font-black px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 whitespace-nowrap font-black">Crédito ${formatarMoeda(-saldo)}</span>`
  }
  return `<span class="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-sm whitespace-nowrap">Em dia</span>`
}

/**
 * Tela inicial: resumo financeiro por período, cadastro e lista de clientes com filtros rápidos.
 */
export async function renderClientes(container: HTMLElement): Promise<void> {
  container.innerHTML = loadingHTML()

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

  let clientes: ClienteComSaldo[]
  let mapaMembros = new Map<string, string>()
  try {
    const [listaClientes, resumoInicial, mapa] = await Promise.all([
      listarClientesComSaldo(),
      obterResumoFinanceiro({ ano: periodoAno, mes: periodoMes }),
      carregarMapaMembros(),
    ])
    clientes = listaClientes
    resumoFin = resumoInicial
    mapaMembros = mapa
  } catch (e) {
    try {
      ;[clientes, mapaMembros] = await Promise.all([
        listarClientesComSaldo(),
        carregarMapaMembros(),
      ])
    } catch (errClientes) {
      container.innerHTML = erroHTML(escaparHTML(mensagemErro(errClientes, 'Erro ao carregar clientes')))
      return
    }
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
    } catch (e) {
      console.warn('Erro ao obter resumo financeiro:', e)
      toast.error(mensagemErro(e, 'Erro ao carregar resumo financeiro'))
    } finally {
      renderResumo()
    }
  }

  const recarregar = async (): Promise<void> => {
    try {
      ;[clientes, mapaMembros] = await Promise.all([
        listarClientesComSaldo(),
        carregarMapaMembros(),
      ])
      renderChips()
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
          <span id="seta-clientes" class="text-xs text-slate-400 group-hover:text-emerald-500 transition-transform">▲</span>
        </button>
        <div id="corpo-clientes" class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
          <!-- Campo de Busca com Botão de Limpar -->
          <div class="relative mb-2.5">
            <input id="busca-cliente" type="search" class="${cls.input} text-xs py-2 pr-7" placeholder="🔍 Buscar cliente por nome ou telefone">
            <button id="btn-limpar-busca" type="button" class="hidden absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-xs rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 font-bold" title="Limpar busca">✕</button>
          </div>

          <!-- Pílulas / Chips de Filtro Deslizantes para Celulares -->
          <div id="chips-filtro-status" class="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none -mx-1 px-1 touch-pan-x"></div>

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
  })

  // Toggle do acordeão: Clientes (não foca automaticamente para não levantar teclado no celular)
  btnToggleClientes.addEventListener('click', () => {
    const fechado = corpoClientes.classList.toggle('hidden')
    setaClientes.textContent = fechado ? '▼' : '▲'
  })

  const chipsContainer = container.querySelector<HTMLElement>('#chips-filtro-status')!
  const btnLimparBusca = container.querySelector<HTMLButtonElement>('#btn-limpar-busca')!

  function renderChips(): void {
    if (!chipsContainer) return
    const qtdTodos = clientes.length
    const qtdPromessas = clientes.filter(c => {
      const dataProm = c.proximo_acerto_data
      if (c.saldo_devedor <= 0 || !dataProm) return false
      const st = obterStatusPromessa(dataProm)?.status
      return st === 'vence_hoje' || st === 'vencida'
    }).length
    const qtdDevedores = clientes.filter(c => c.saldo_devedor > 0).length
    const qtdAntigos = clientes.filter(c => c.saldo_devedor > 0 && (c.dias_atraso || 0) >= 30).length
    const qtdEmDia = clientes.filter(c => c.saldo_devedor <= 0).length

    const itens: { id: FiltroStatus; label: string; count: number }[] = [
      { id: 'todos', label: '⚪ Todos', count: qtdTodos },
      { id: 'promessas', label: '⏰ Vencem Hoje', count: qtdPromessas },
      { id: 'devedores', label: '🔴 Devedores', count: qtdDevedores },
      { id: 'antigos', label: '⚠️ +30d', count: qtdAntigos },
      { id: 'em_dia', label: '🟢 Em Dia', count: qtdEmDia },
    ]

    chipsContainer.innerHTML = itens
      .map(item => {
        const ativo = filtroStatus === item.id
        return `
          <button type="button" data-filtro-chip="${item.id}" class="text-xs px-3 py-1.5 rounded-xl transition whitespace-nowrap active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer ${
            ativo
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-black shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold'
          }">
            <span>${item.label}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full ${
              ativo
                ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-950 font-black'
                : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold'
            }">${item.count}</span>
          </button>
        `
      })
      .join('')

    chipsContainer.querySelectorAll<HTMLButtonElement>('[data-filtro-chip]').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroStatus = btn.dataset.filtroChip as FiltroStatus
        renderChips()
        renderLista()
      })
    })
  }

  // Event delegation nos botões de período do resumo
  resumoEl.addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-acao]')
    if (!btn) return
    const acao = btn.dataset.acao

    if (acao === 'mes-anterior') {
      periodoTipo = 'mes'
      if (periodoMes === 1) {
        periodoMes = 12
        periodoAno--
      } else {
        periodoMes--
      }
      await atualizarResumoFinanceiro()
    } else if (acao === 'mes-proximo') {
      periodoTipo = 'mes'
      if (periodoMes === 12) {
        periodoMes = 1
        periodoAno++
      } else {
        periodoMes++
      }
      await atualizarResumoFinanceiro()
    } else if (acao === 'periodo-atual') {
      periodoTipo = 'mes'
      periodoAno = dataHoje.getFullYear()
      periodoMes = dataHoje.getMonth() + 1
      await atualizarResumoFinanceiro()
    } else if (acao === 'periodo-anterior') {
      periodoTipo = 'mes'
      const ant = new Date(dataHoje.getFullYear(), dataHoje.getMonth() - 1, 1)
      periodoAno = ant.getFullYear()
      periodoMes = ant.getMonth() + 1
      await atualizarResumoFinanceiro()
    } else if (acao === 'periodo-tudo') {
      periodoTipo = 'tudo'
      await atualizarResumoFinanceiro()
    }
  })

  function renderResumo(): void {
    const aReceberGeral = clientes.reduce((acc, c) => acc + (c.saldo_devedor > 0 ? c.saldo_devedor : 0), 0)
    const devedoresGeral = clientes.filter(c => c.saldo_devedor > 0).length
    const devedoresAntigosGeral = clientes.filter(c => c.saldo_devedor > 0 && (c.dias_atraso || 0) >= 30).length

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
            <button data-acao="mes-anterior" type="button" class="px-2 py-0.5 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-emerald-500 rounded-lg transition active:scale-95" title="Mês anterior">◀</button>
            <span id="rotulo-mes-ano" class="text-xs font-black text-slate-900 dark:text-white px-1 whitespace-nowrap">${escaparHTML(rotuloPeriodo)}</span>
            <button data-acao="mes-proximo" type="button" class="px-2 py-0.5 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-emerald-500 rounded-lg transition active:scale-95" title="Próximo mês">▶</button>
          </div>
        </div>

        <div class="flex items-center gap-1 text-[11px] font-bold" role="group">
          <button data-acao="periodo-atual" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition active:scale-95 ${
            ehMesAtual
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">Este Mês</button>
          <button data-acao="periodo-anterior" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition active:scale-95 ${
            ehMesAnterior
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">Mês Anterior</button>
          <button data-acao="periodo-tudo" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition active:scale-95 ${
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
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block truncate">
            ${devedoresGeral} devedores${devedoresAntigosGeral > 0 ? ` • <strong class="text-amber-600 dark:text-amber-400">${devedoresAntigosGeral} (+30d)</strong>` : ''}
          </span>
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
  }

  function renderLista(): void {
    const totalTodos = clientes.length
    const totalDevedores = clientes.filter(c => c.saldo_devedor > 0).length
    const totalAntigos = clientes.filter(c => c.saldo_devedor > 0 && (c.dias_atraso || 0) >= 30).length
    const totalEmDia = clientes.filter(c => c.saldo_devedor <= 0).length
    const totalPromessas = clientes.filter(c => {
      const dataProm = c.proximo_acerto_data
      if (c.saldo_devedor <= 0 || !dataProm) return false
      const st = obterStatusPromessa(dataProm)?.status
      return st === 'vence_hoje' || st === 'vencida'
    }).length

    const selectFiltroEl = container.querySelector<HTMLSelectElement>('#select-filtro-status')
    if (selectFiltroEl) {
      selectFiltroEl.value = filtroStatus
      const optTodos = selectFiltroEl.querySelector<HTMLOptionElement>('option[value="todos"]')
      const optPromessas = selectFiltroEl.querySelector<HTMLOptionElement>('option[value="promessas"]')
      const optDevedores = selectFiltroEl.querySelector<HTMLOptionElement>('option[value="devedores"]')
      const optAntigos = selectFiltroEl.querySelector<HTMLOptionElement>('option[value="antigos"]')
      const optEmDia = selectFiltroEl.querySelector<HTMLOptionElement>('option[value="em_dia"]')
      if (optTodos) optTodos.textContent = `⚪ Todos (${totalTodos})`
      if (optPromessas) optPromessas.textContent = `⏰ Promessas Hoje/Vencidas (${totalPromessas})`
      if (optDevedores) optDevedores.textContent = `🔴 Débitos (${totalDevedores})`
      if (optAntigos) optAntigos.textContent = `⚠️ Débitos +30 Dias (${totalAntigos})`
      if (optEmDia) optEmDia.textContent = `🟢 Em Dia (${totalEmDia})`
    }

    const termo = normalizarBusca(busca.trim())
    const termoDigitos = busca.replace(/\D/g, '')

    const filtrados = clientes.filter(c => {
      // Regra do filtro selecionável
      if (filtroStatus === 'promessas') {
        const dataProm = c.proximo_acerto_data
        if (c.saldo_devedor <= 0 || !dataProm) return false
        const st = obterStatusPromessa(dataProm)?.status
        if (st !== 'vence_hoje' && st !== 'vencida') return false
      }
      if (filtroStatus === 'devedores' && c.saldo_devedor <= 0) return false
      if (filtroStatus === 'antigos' && (c.saldo_devedor <= 0 || (c.dias_atraso || 0) < 30)) return false
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
      } else if (filtroStatus === 'promessas') {
        mensagemVazia = '🎉 Excelente! Nenhuma promessa de pagamento para hoje ou em atraso.'
      } else if (filtroStatus === 'antigos') {
        mensagemVazia = '🎉 Excelente! Nenhum cliente com débito pendente há mais de 30 dias.'
      } else if (filtroStatus === 'devedores') {
        mensagemVazia = '🎉 Que ótimo! Nenhum cliente com débito pendente no momento.'
      } else if (filtroStatus === 'em_dia') {
        mensagemVazia = 'Nenhum cliente com pagamentos em dia encontrado.'
      }

      listaEl.innerHTML = `<li class="text-center py-6 text-sm text-slate-500 dark:text-slate-400 font-medium">${escaparHTML(mensagemVazia)}</li>`
      return
    }

    listaEl.innerHTML = filtrados
      .map(c => {
        const dias = c.dias_atraso || 0
        const temAtraso = c.saldo_devedor > 0 && dias >= 30
        const dataPromessa = c.proximo_acerto_data
        const infoPromessa = c.saldo_devedor > 0 && dataPromessa ? obterStatusPromessa(dataPromessa) : null

        let subtituloAcerto = ''
        let estiloCard = ''
        let estiloAvatar = ''

        if (c.saldo_devedor <= 0) {
          // 1. Cliente Em Dia (Verde Esmeralda destacado, sem rodapé de acerto)
          estiloCard =
            'border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 shadow-sm'
          estiloAvatar = 'bg-emerald-600 text-white font-black'
        } else if (infoPromessa && dataPromessa) {
          // 2. Cliente Devedor COM acerto cadastrado (Vermelho, Laranja Pulsante ou Azul)
          const dataFormatada = formatarData(dataPromessa).slice(0, 5) // DD/MM
          const valorFormatado = c.proximo_acerto_valor ? ` (${formatarMoeda(c.proximo_acerto_valor)})` : ''
          const qtdRestante =
            c.qtd_acertos_pendentes && c.qtd_acertos_pendentes > 1
              ? ` • ${c.qtd_acertos_pendentes} restantes`
              : ''

          if (infoPromessa.status === 'vence_hoje') {
            estiloCard =
              'border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-950/50 dark:hover:bg-amber-950/70 ring-2 ring-amber-400/60 animate-pulse shadow-sm'
            estiloAvatar = 'bg-amber-500 text-slate-950 font-black'
          } else if (infoPromessa.status === 'vencida') {
            estiloCard =
              'border-2 border-rose-500 bg-rose-50 hover:bg-rose-100 dark:border-rose-500 dark:bg-rose-950/50 dark:hover:bg-rose-950/70 ring-2 ring-rose-400/60 shadow-sm'
            estiloAvatar = 'bg-rose-600 text-white font-black'
          } else {
            estiloCard =
              'border-2 border-sky-400 bg-sky-50 hover:bg-sky-100 dark:border-sky-500 dark:bg-sky-950/50 dark:hover:bg-sky-950/70 ring-1 ring-sky-400/50 shadow-sm'
            estiloAvatar = 'bg-sky-600 text-white font-black'
          }

          subtituloAcerto = `
          <div class="flex items-center gap-1.5 text-xs font-black ${
            infoPromessa.status === 'vencida'
              ? 'text-rose-700 dark:text-rose-300'
              : infoPromessa.status === 'vence_hoje'
                ? 'text-amber-800 dark:text-amber-200'
                : 'text-sky-700 dark:text-sky-300'
          }">
            <span class="text-sm shrink-0">${infoPromessa.status === 'vencida' ? '🚨' : infoPromessa.status === 'vence_hoje' ? '⏰' : '🗓️'}</span>
            <span class="truncate">Próximo acerto: ${dataFormatada}${valorFormatado}${qtdRestante}</span>
          </div>`
        } else {
          // 3. Cliente Devedor SEM acerto cadastrado (Padrão Diferenciado com borda tracejada e rodapé)
          if (dias >= 60) {
            estiloCard =
              'border-2 border-dashed border-rose-400 bg-rose-50/40 hover:bg-rose-50/70 dark:border-rose-500/70 dark:bg-rose-950/30 shadow-sm'
            estiloAvatar = 'bg-rose-500/20 text-rose-700 dark:text-rose-300 font-black'
          } else if (dias >= 30) {
            estiloCard =
              'border-2 border-dashed border-amber-400 bg-amber-50/40 hover:bg-amber-50/70 dark:border-amber-500/70 dark:bg-amber-950/30 shadow-sm'
            estiloAvatar = 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black'
          } else {
            estiloCard =
              'border-2 border-dashed border-slate-400 bg-slate-50 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 shadow-sm'
            estiloAvatar = 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black'
          }

          subtituloAcerto = `
          <div class="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
            <span class="text-sm shrink-0">⚠️</span>
            <span class="truncate">Nenhum acerto cadastrado</span>
          </div>`
        }

        const avisoAtraso = temAtraso
          ? `
          <div class="flex items-center gap-1.5 text-[11px] font-bold ${
            dias >= 60 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
          }">
            <span class="shrink-0">${dias >= 60 ? '🚨' : '⏳'}</span>
            <span class="truncate">Pendente há ${dias} dias ${
              c.ultimo_pagamento
                ? `(último pgto ${formatarData(c.ultimo_pagamento)})`
                : '(sem nenhum pagamento registrado)'
            }</span>
          </div>`
          : ''

        const temRodape = Boolean(subtituloAcerto || avisoAtraso)

        return `
        <li class="group flex flex-col ${estiloCard} rounded-2xl p-2.5 sm:px-3 sm:py-2.5 transition">
          <div class="flex items-center justify-between gap-2">
            <a href="#/cliente/${c.id}" class="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3">
              <div class="w-9 h-9 rounded-full ${estiloAvatar} flex items-center justify-center font-black text-sm shrink-0">
                ${escaparHTML(c.nome.trim().charAt(0).toUpperCase())}
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-sm text-slate-900 dark:text-white truncate">${escaparHTML(c.nome)}</p>
                <div class="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  <span>${c.telefone ? escaparHTML(c.telefone) : 'Sem telefone'}</span>
                  <span>•</span>
                  <span class="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500">${formatarAutoriaResumida(c, mapaMembros)}</span>
                </div>
              </div>
              <div class="shrink-0">
                ${badgeSaldo(c.saldo_devedor, c.dias_atraso)}
              </div>
            </a>
            <div class="flex items-center gap-1 shrink-0">
              ${
                c.telefone
                  ? `<button type="button" data-whats-cliente="${c.id}" class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition shadow-xs cursor-pointer" title="Abrir WhatsApp">
                      <span class="text-sm">💬</span>
                    </button>`
                  : ''
              }
              <button data-editar="${c.id}" class="${cls.btnIcone}" title="Editar cliente">✏️</button>
              <button data-excluir="${c.id}" class="${cls.btnIcone}" title="Excluir cliente">🗑️</button>
            </div>
          </div>

          ${
            temRodape
              ? `
            <a href="#/cliente/${c.id}" class="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-1 text-left">
              ${subtituloAcerto}
              ${avisoAtraso}
            </a>
          `
              : ''
          }
        </li>`
      })
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
    if (btnLimparBusca) btnLimparBusca.classList.toggle('hidden', !busca)
    renderLista()
  })

  btnLimparBusca?.addEventListener('click', () => {
    buscaInput.value = ''
    busca = ''
    btnLimparBusca.classList.add('hidden')
    renderLista()
    buscaInput.focus()
  })

  listaEl.addEventListener('click', async e => {
    const btnWhats = (e.target as HTMLElement).closest<HTMLElement>('[data-whats-cliente]')
    if (btnWhats) {
      e.preventDefault()
      e.stopPropagation()
      const id = btnWhats.dataset.whatsCliente!
      const cliente = clientes.find(c => c.id === id)
      if (!cliente || !cliente.telefone) return

      if (cliente.saldo_devedor > 0) {
        try {
          const perfil = await obterPerfilAtual()
          const opcoesPix = {
            chavePix: perfil?.chave_pix,
            nomeProfissional: perfil?.beneficiario_pix || perfil?.nome,
          }
          enviarLembreteCobrancaWhatsApp(cliente, cliente.saldo_devedor, opcoesPix)
        } catch {
          enviarLembreteCobrancaWhatsApp(cliente, cliente.saldo_devedor)
        }
      } else {
        const telLimpo = cliente.telefone.replace(/\D/g, '')
        const msg = encodeURIComponent(`Olá, ${cliente.nome}! Tudo bem? 🌸`)
        window.open(`https://api.whatsapp.com/send?phone=55${telLimpo}&text=${msg}`, '_blank')
      }
      return
    }

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
  renderChips()
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
