import { abrirFormModal, confirmar } from '@/components/Modal'
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientesComSaldo,
} from '@/services/clientes'
import { carregarMapaMembros } from '@/services/equipe'
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
        <span class="text-xs font-black px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 whitespace-nowrap inline-flex items-center gap-1.5" title="Débito crítico pendente há mais de 60 dias sem pagamentos">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
          🚨 Deve ${formatarMoeda(saldo)} • +60d
        </span>`
    }
    if (diasAtraso >= 30) {
      return `
        <span class="text-xs font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap inline-flex items-center gap-1.5" title="Débito pendente há mais de 30 dias sem pagamentos">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
          ⏳ Deve ${formatarMoeda(saldo)} • ${diasAtraso}d
        </span>`
    }
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
          <!-- Busca e Filtro Selecionável Compacto -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
            <div class="flex-1 min-w-0">
              <input id="busca-cliente" type="search" class="${cls.input} text-xs py-2" placeholder="🔍 Buscar cliente por nome ou telefone">
            </div>
            <div class="w-full sm:w-64 shrink-0">
              <select id="select-filtro-status" class="${cls.input} text-xs font-bold py-2 bg-slate-50 dark:bg-slate-800 cursor-pointer" aria-label="Filtrar clientes por status">
                <option value="todos">⚪ Todos os Clientes</option>
                <option value="promessas">⏰ Promessas Hoje / Vencidas</option>
                <option value="devedores">🔴 Clientes com Débito</option>
                <option value="antigos">⚠️ Débitos +30 Dias</option>
                <option value="em_dia">🟢 Clientes em Dia</option>
              </select>
            </div>
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
  })

  // Toggle do acordeão: Clientes (não foca automaticamente para não levantar teclado no celular)
  btnToggleClientes.addEventListener('click', () => {
    const fechado = corpoClientes.classList.toggle('hidden')
    setaClientes.textContent = fechado ? '▼' : '▲'
  })

  // Seletor compacto de filtro de status
  const selectFiltro = container.querySelector<HTMLSelectElement>('#select-filtro-status')
  if (selectFiltro) {
    selectFiltro.addEventListener('change', () => {
      filtroStatus = selectFiltro.value as FiltroStatus
      renderLista()
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
      if (c.saldo_devedor <= 0 || !c.data_promessa) return false
      const st = obterStatusPromessa(c.data_promessa)?.status
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
        if (c.saldo_devedor <= 0 || !c.data_promessa) return false
        const st = obterStatusPromessa(c.data_promessa)?.status
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
        const infoPromessa = c.saldo_devedor > 0 ? obterStatusPromessa(c.data_promessa) : null

        const avisoAtraso = temAtraso
          ? `
          <div class="mt-1 flex items-center gap-1.5 text-[11px] font-bold ${
            dias >= 60 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
          }">
            <span>${dias >= 60 ? '🚨' : '⏳'}</span>
            <span>Pendente há ${dias} dias ${
              c.ultimo_pagamento
                ? `(último pgto ${formatarData(c.ultimo_pagamento)})`
                : '(sem nenhum pagamento registrado)'
            }</span>
          </div>`
          : ''

        // Cores de todo o card conforme status de promessa ou envelhecimento do débito
        let estiloCard = 'border-slate-200 dark:border-slate-700/80 bg-slate-50 hover:bg-emerald-50/60 dark:bg-slate-800/60 dark:hover:bg-slate-800'
        let estiloAvatar = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'

        if (c.saldo_devedor > 0 && infoPromessa) {
          if (infoPromessa.status === 'vence_hoje') {
            // Promessa Vence Hoje! -> card fica amarelo/laranja pulsante
            estiloCard = 'border-amber-400 dark:border-amber-500 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 ring-2 ring-amber-400/50 animate-pulse'
            estiloAvatar = 'bg-amber-500 text-slate-950 font-black'
          } else if (infoPromessa.status === 'vencida') {
            // Promessa Vencida -> card fica na cor alerta vermelho
            estiloCard = 'border-rose-400 dark:border-rose-500 bg-rose-500/15 hover:bg-rose-500/25 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 ring-2 ring-rose-400/50'
            estiloAvatar = 'bg-rose-500 text-white font-black'
          } else if (infoPromessa.status === 'a_vencer') {
            // Acerto Futuro -> card fica na cor indicador azul
            estiloCard = 'border-sky-400 dark:border-sky-500 bg-sky-500/15 hover:bg-sky-500/25 dark:bg-sky-950/40 dark:hover:bg-sky-950/60 ring-1 ring-sky-400/50'
            estiloAvatar = 'bg-sky-500 text-white font-black'
          }
        } else if (dias >= 60) {
          estiloCard = 'border-rose-400/80 dark:border-rose-500/50 bg-rose-50/20 hover:bg-rose-50/40'
          estiloAvatar = 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
        } else if (dias >= 30) {
          estiloCard = 'border-amber-400/80 dark:border-amber-500/50 bg-amber-50/20 hover:bg-amber-50/40'
          estiloAvatar = 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        }

        return `
        <li class="group flex items-center gap-2 ${estiloCard} rounded-2xl pl-3 pr-1.5 py-2 transition">
          <a href="#/cliente/${c.id}" class="flex-1 min-w-0 flex items-center gap-3">
            <div class="w-9 h-9 rounded-full ${estiloAvatar} flex items-center justify-center font-black text-sm shrink-0">
              ${escaparHTML(c.nome.trim().charAt(0).toUpperCase())}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-bold text-sm text-slate-900 dark:text-white truncate">${escaparHTML(c.nome)}</p>
              <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                <span>${c.telefone ? escaparHTML(c.telefone) : 'Sem telefone'}</span>
                <span>•</span>
                <span class="text-[11px] text-slate-400 dark:text-slate-500">${formatarAutoriaResumida(c, mapaMembros)}</span>
              </div>
              ${avisoAtraso}
            </div>
            ${badgeSaldo(c.saldo_devedor, c.dias_atraso)}
          </a>
          <button data-editar="${c.id}" class="${cls.btnIcone}" title="Editar cliente">✏️</button>
          <button data-excluir="${c.id}" class="${cls.btnIcone}" title="Excluir cliente">🗑️</button>
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
