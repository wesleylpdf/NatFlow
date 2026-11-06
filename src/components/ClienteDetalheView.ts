import { abrirFormModal, confirmar } from '@/components/Modal'
import { abrirEdicaoCliente } from '@/components/ClientesView'
import { listarClientes } from '@/services/clientes'
import { atualizarCompra, criarCompra, excluirCompra, listarCompras } from '@/services/compras'
import {
  atualizarPagamento,
  criarPagamento,
  excluirPagamento,
  listarPagamentos,
} from '@/services/pagamentos'
import { obterPerfilAtual } from '@/services/equipe'
import { obterSugestoesCatalogo } from '@/services/catalogo'
import type { Cliente, Compra, Pagamento, Autorizado } from '@/types'
import {
  calcularDiasAtraso,
  escaparHTML,
  formatarAutoriaResumida,
  formatarData,
  formatarMoeda,
  hojeISO,
  linkWhatsApp,
  obterInfoFormaPagamento,
  parseValor,
  valorParaInput,
} from '@/utils/format'
import { calcularResumo } from '@/utils/saldo'
import { enviarExtratoWhatsApp, enviarLembreteCobrancaWhatsApp } from '@/utils/exportarPdf'
import { toast, mensagemErro } from '@/utils/toast'
import { cls, erroHTML, loadingHTML } from '@/utils/ui'

type Aba = 'compras' | 'pagamentos'

let abaAtual: Aba = 'compras'
let buscaLancamento = ''
let ordemLancamento = 'data-desc'

/** Valida e converte valor digitado; lança erro com mensagem amigável. */
function validarValor(texto: string): number {
  const valor = parseValor(texto)
  if (isNaN(valor) || valor <= 0) throw new Error('Informe um valor válido maior que zero')
  return valor
}

function validarData(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Informe uma data válida')
  return data
}

function ordenarItens<T extends { data: string; valor: number; created_at?: string }>(
  itens: T[],
  ordem: string
): T[] {
  return [...itens].sort((a, b) => {
    switch (ordem) {
      case 'data-asc':
        return a.data.localeCompare(b.data)
      case 'data-desc':
        return b.data.localeCompare(a.data)
      case 'valor-asc':
        return a.valor - b.valor
      case 'valor-desc':
        return b.valor - a.valor
      case 'criado-asc':
        return (a.created_at || '').localeCompare(b.created_at || '')
      case 'criado-desc':
        return (b.created_at || '').localeCompare(a.created_at || '')
      default:
        return b.data.localeCompare(a.data)
    }
  })
}

/**
 * Tela do cliente: saldo devedor, entradas (pagamentos) e saídas (produtos comprados).
 */
export async function renderClienteDetalhe(container: HTMLElement, clienteId: string): Promise<void> {
  container.innerHTML = loadingHTML(4)

  let clientes: Cliente[]
  let compras: Compra[]
  let pagamentos: Pagamento[]
  let perfil: Autorizado | null = null

  try {
    ;[clientes, compras, pagamentos, perfil] = await Promise.all([
      listarClientes(),
      listarCompras(clienteId),
      listarPagamentos(clienteId),
      obterPerfilAtual(),
    ])
  } catch (e) {
    container.innerHTML = erroHTML(escaparHTML(mensagemErro(e, 'Erro ao carregar cliente')))
    return
  }

  let cliente = clientes.find(c => c.id === clienteId)
  if (!cliente) {
    container.innerHTML = `
      <div class="max-w-3xl mx-auto ${cls.card} p-6 text-center">
        <p class="text-3xl mb-2">🔎</p>
        <p class="font-bold mb-4">Cliente não encontrado.</p>
        <a href="#/" class="${cls.btnSecundario} inline-block">← Voltar para clientes</a>
      </div>`
    return
  }

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="flex items-center gap-2">
        <a href="#/" class="${cls.btnSecundario} shrink-0" title="Voltar para clientes">←</a>
        <select id="seletor-cliente" class="${cls.input} font-bold" aria-label="Escolher cliente"></select>
      </div>

      <section id="painel-cliente" class="relative overflow-hidden bg-white/95 text-slate-900 border border-slate-200/90 shadow-md dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 dark:text-white dark:border-slate-800 p-4 sm:p-5 rounded-3xl"></section>

      <section class="${cls.card} p-4 sm:p-5">
        <div class="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4" role="tablist">
          <button data-aba="compras" role="tab" class="py-2.5 rounded-xl text-sm font-extrabold transition">🛍️ Produtos</button>
          <button data-aba="pagamentos" role="tab" class="py-2.5 rounded-xl text-sm font-extrabold transition">💵 Pagamentos</button>
        </div>
        <div id="conteudo-aba"></div>
      </section>
    </div>
  `

  const seletor = container.querySelector<HTMLSelectElement>('#seletor-cliente')!
  const painelEl = container.querySelector<HTMLElement>('#painel-cliente')!
  const abaEl = container.querySelector<HTMLElement>('#conteudo-aba')!
  const botoesAba = container.querySelectorAll<HTMLButtonElement>('[data-aba]')

  // ---------- Seletor de cliente ----------
  function renderSeletor(): void {
    seletor.innerHTML = clientes
      .map(
        c =>
          `<option value="${c.id}" ${c.id === clienteId ? 'selected' : ''}>${escaparHTML(c.nome)}</option>`
      )
      .join('')
  }

  seletor.addEventListener('change', () => {
    window.location.hash = `#/cliente/${seletor.value}`
  })

  // ---------- Painel com saldo, autoria, alerta de débito antigo e botões WhatsApp ----------
  function renderPainel(): void {
    const c = cliente!
    const { totalCompras, totalPagamentos, saldoDevedor } = calcularResumo(compras, pagamentos)
    const whats = linkWhatsApp(c.telefone)
    const rotuloSaldo = saldoDevedor < 0 ? 'Crédito do cliente' : 'Saldo devedor'
    const corSaldo =
      saldoDevedor > 0
        ? 'text-rose-600 dark:text-rose-400'
        : saldoDevedor < 0
          ? 'text-sky-600 dark:text-sky-400'
          : 'text-emerald-600 dark:text-emerald-400'

    // Cálculo do tempo de débito sem pagamentos
    const ultimoPag = pagamentos.length > 0 ? pagamentos[0] : null
    const primeiraComp = compras.length > 0 ? compras[compras.length - 1] : null
    const dataBase = ultimoPag ? ultimoPag.data : (primeiraComp ? primeiraComp.data : c.created_at.slice(0, 10))
    const diasAtraso = saldoDevedor > 0 ? calcularDiasAtraso(dataBase) : 0

    let bannerAtraso = ''
    if (diasAtraso >= 30) {
      bannerAtraso = `
        <div class="mb-4 p-3 rounded-2xl ${
          diasAtraso >= 60
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
        } border flex items-center justify-between gap-3 animate-fade-in">
          <div class="flex items-center gap-2.5 text-xs font-bold">
            <span class="text-xl shrink-0">${diasAtraso >= 60 ? '🚨' : '⏳'}</span>
            <div>
              <p class="font-black text-xs sm:text-sm ${
                diasAtraso >= 60 ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'
              }">
                ${diasAtraso >= 60 ? 'Alerta Crítico: ' : 'Atenção: '}Saldo devedor pendente há ${diasAtraso} dias!
              </p>
              <p class="text-[11px] opacity-80 mt-0.5 font-medium">
                ${
                  ultimoPag
                    ? `Último pagamento recebido em ${formatarData(ultimoPag.data)} (${formatarMoeda(ultimoPag.valor)}).`
                    : 'Este cliente ainda não realizou nenhum pagamento.'
                }
              </p>
            </div>
          </div>
        </div>
      `
    }

    const linkWhatsTelefone = whats && c.telefone
      ? `<a href="${whats}" target="_blank" rel="noopener"
           class="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
           title="Abrir WhatsApp do cliente"
           aria-label="Abrir WhatsApp">
          <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.66 20.16 9.3 19.8 8.1 19.11L7.81 18.94L4.7 19.76L5.53 16.73L5.34 16.43C4.56 15.19 4.14 13.57 4.14 11.92C4.15 7.38 7.84 3.67 12.05 3.67M9.54 7.39C9.37 7.39 9.1 7.45 8.87 7.7C8.63 7.96 7.96 8.59 7.96 9.87C7.96 11.15 8.89 12.39 9.02 12.56C9.15 12.73 10.82 15.31 13.4 16.42C14.02 16.68 14.5 16.84 14.88 16.96C15.5 17.16 16.06 17.13 16.51 17.06C17.01 16.99 18.06 16.43 18.28 15.81C18.5 15.19 18.5 14.65 18.43 14.54C18.37 14.43 18.19 14.37 17.92 14.23C17.65 14.1 16.36 13.47 16.12 13.38C15.88 13.29 15.71 13.25 15.53 13.51C15.36 13.78 14.86 14.37 14.71 14.54C14.56 14.71 14.41 14.73 14.14 14.6C13.87 14.46 13.01 14.18 11.99 13.27C11.19 12.56 10.65 11.68 10.49 11.41C10.34 11.15 10.47 11 10.61 10.87C10.73 10.75 10.87 10.56 11.01 10.4C11.15 10.23 11.2 10.11 11.29 9.93C11.38 9.75 11.33 9.6 11.26 9.47C11.2 9.34 10.69 8.08 10.48 7.57C10.27 7.07 10.06 7.14 9.9 7.13C9.74 7.12 9.54 7.39 9.54 7.39Z"/>
          </svg>
          ${escaparHTML(c.telefone)}
        </a>`
      : `<span class="text-xs text-slate-400 dark:text-slate-500">${c.telefone ? escaparHTML(c.telefone) : 'Sem telefone'}</span>`

    // Botão de Cobrança rápida via WhatsApp (exibido apenas quando cliente deve)
    const btnCobrarWhatsApp =
      saldoDevedor > 0
        ? `<button id="btn-cobrar-whatsapp" type="button"
             class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-rose-500 hover:bg-rose-600 active:scale-95 text-white shadow-sm transition"
             title="Enviar lembrete amigável de cobrança no WhatsApp com a chave PIX${diasAtraso >= 30 ? ` (Pendente há ${diasAtraso} dias)` : ''}">
             💬 Cobrar Saldo
           </button>`
        : ''

    painelEl.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">${escaparHTML(c.nome)}</h2>
            <button id="btn-editar-cliente" class="${cls.btnIcone}" title="Editar cliente">✏️</button>
          </div>
          <div class="flex items-center gap-3 mt-1 flex-wrap">
            ${linkWhatsTelefone}
            <span class="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">${formatarAutoriaResumida(c)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${btnCobrarWhatsApp}
          <button id="btn-extrato-whats" type="button"
            class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm transition"
            title="Baixar PDF e enviar extrato completo para o cliente no WhatsApp">
            📄 Extrato
          </button>
        </div>
      </div>

      ${bannerAtraso}

      <div class="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div class="bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-300 uppercase font-extrabold tracking-wide">🛍️ Produtos</span>
          <span class="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 truncate block">${formatarMoeda(totalCompras)}</span>
        </div>
        <div class="bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-300 uppercase font-extrabold tracking-wide">💵 Pagamentos</span>
          <span class="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 truncate block">${formatarMoeda(totalPagamentos)}</span>
        </div>
        <div class="bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-2xl px-3 py-2.5">
          <span class="block text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-300 uppercase font-extrabold tracking-wide">📌 ${rotuloSaldo}</span>
          <span class="text-base sm:text-lg font-black ${corSaldo} truncate block">${formatarMoeda(Math.abs(saldoDevedor))}</span>
        </div>
      </div>
    `

    painelEl.querySelector('#btn-editar-cliente')?.addEventListener('click', () => {
      abrirEdicaoCliente(cliente!, async () => {
        clientes = await listarClientes()
        cliente = clientes.find(item => item.id === clienteId)
        renderSeletor()
        renderPainel()
      })
    })

    painelEl.querySelector('#btn-extrato-whats')?.addEventListener('click', () => {
      const opcoesPix = {
        chavePix: perfil?.chave_pix,
        nomeProfissional: perfil?.nome,
      }
      enviarExtratoWhatsApp(cliente!, compras, pagamentos, true, opcoesPix)
    })

    painelEl.querySelector('#btn-cobrar-whatsapp')?.addEventListener('click', () => {
      const opcoesPix = {
        chavePix: perfil?.chave_pix,
        nomeProfissional: perfil?.nome,
      }
      enviarLembreteCobrancaWhatsApp(cliente!, saldoDevedor, opcoesPix)
    })
  }

  // ---------- Abas ----------
  function renderAbas(): void {
    botoesAba.forEach(b => {
      const selecionada = b.dataset.aba === abaAtual
      b.setAttribute('aria-selected', String(selecionada))
      b.className = `py-2.5 rounded-xl text-sm font-extrabold transition ${
        selecionada
          ? 'bg-white dark:bg-slate-900 shadow text-emerald-700 dark:text-emerald-300'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`
    })
    if (abaAtual === 'compras') renderAbaCompras()
    else renderAbaPagamentos()
  }

  botoesAba.forEach(b =>
    b.addEventListener('click', () => {
      abaAtual = b.dataset.aba as Aba
      renderAbas()
    })
  )

  async function recarregarLancamentos(): Promise<void> {
    try {
      const [novasCompras, novosPagamentos, novoPerfil] = await Promise.all([
        listarCompras(clienteId),
        listarPagamentos(clienteId),
        obterPerfilAtual(true),
      ])
      compras = novasCompras
      pagamentos = novosPagamentos
      perfil = novoPerfil
      renderPainel()
      renderAbas()
    } catch (e) {
      toast.error(mensagemErro(e, 'Erro ao atualizar lançamentos'))
    }
  }

  function itemLista(opts: {
    id: string
    titulo: string
    subtitulo: string
    badgeExtra?: string
    autoria?: string
    valor: number
    cor: 'rose' | 'emerald'
  }): string {
    const corValor =
      opts.cor === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
    const sinal = opts.cor === 'rose' ? '−' : '+'
    return `
      <li class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl pl-3 pr-1.5 py-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-bold text-sm text-slate-900 dark:text-white truncate">${opts.titulo}</p>
            ${opts.badgeExtra ?? ''}
          </div>
          <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            <span>${opts.subtitulo}</span>
            ${opts.autoria ? `<span>•</span><span class="text-[11px] text-slate-400 dark:text-slate-500">${opts.autoria}</span>` : ''}
          </div>
        </div>
        <span class="font-black text-sm ${corValor} whitespace-nowrap">${sinal} ${formatarMoeda(opts.valor)}</span>
        <button data-editar="${opts.id}" class="${cls.btnIcone}" title="Editar">✏️</button>
        <button data-excluir="${opts.id}" class="${cls.btnIcone}" title="Excluir">🗑️</button>
      </li>`
  }

  function barraBuscaEOrdenacao(): string {
    return `
      <div class="flex items-center gap-2 mb-3.5">
        <div class="flex-1 min-w-0">
          <input id="busca-item" type="search" class="${cls.input} text-xs py-2"
            placeholder="🔍 Buscar produto ou valor..."
            value="${escaparHTML(buscaLancamento)}">
        </div>
        <div class="w-36 sm:w-52 shrink-0">
          <select id="ordem-item" class="${cls.input} text-xs font-semibold py-2">
            <option value="data-desc" ${ordemLancamento === 'data-desc' ? 'selected' : ''}>📅 Data (Recente)</option>
            <option value="data-asc" ${ordemLancamento === 'data-asc' ? 'selected' : ''}>📅 Data (Antigo)</option>
            <option value="valor-desc" ${ordemLancamento === 'valor-desc' ? 'selected' : ''}>💰 Valor (Maior)</option>
            <option value="valor-asc" ${ordemLancamento === 'valor-asc' ? 'selected' : ''}>💰 Valor (Menor)</option>
            <option value="criado-desc" ${ordemLancamento === 'criado-desc' ? 'selected' : ''}>🕒 Criado (Recente)</option>
            <option value="criado-asc" ${ordemLancamento === 'criado-asc' ? 'selected' : ''}>🕒 Criado (Antigo)</option>
          </select>
        </div>
      </div>
    `
  }

  function conectarBuscaEOrdenacao(onFiltrar: () => void): void {
    const inputBusca = abaEl.querySelector<HTMLInputElement>('#busca-item')
    const selectOrdem = abaEl.querySelector<HTMLSelectElement>('#ordem-item')

    if (inputBusca) {
      inputBusca.addEventListener('input', () => {
        buscaLancamento = inputBusca.value
        onFiltrar()
      })
    }
    if (selectOrdem) {
      selectOrdem.addEventListener('change', () => {
        ordemLancamento = selectOrdem.value
        onFiltrar()
      })
    }
  }

  function listaVazia(texto: string): string {
    return `<li class="text-center py-6 text-sm text-slate-500 dark:text-slate-400">${texto}</li>`
  }

  // ---------- Aba: Produtos comprados (saídas) com Autocomplete ----------
  function renderAbaCompras(): void {
    abaEl.innerHTML = `
      <form id="form-compra" novalidate class="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2.5 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 relative">
        <div class="col-span-2 sm:col-span-1 relative">
          <label class="${cls.label}" for="compra-produto">Produto / Serviço</label>
          <input id="compra-produto" type="text" class="${cls.input}" placeholder="Ex: Creme hidratante, Design..." autocomplete="off" maxlength="160">
          <div id="autocomplete-produtos" class="hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-56 overflow-y-auto p-1.5 space-y-1"></div>
        </div>
        <div>
          <label class="${cls.label}" for="compra-valor">Valor (R$)</label>
          <input id="compra-valor" type="text" inputmode="decimal" class="${cls.input}" placeholder="0,00" autocomplete="off">
        </div>
        <div>
          <label class="${cls.label}" for="compra-data">Data</label>
          <input id="compra-data" type="date" class="${cls.input}" value="${hojeISO()}">
        </div>
        <div class="col-span-2 sm:col-span-1 flex items-end">
          <button type="submit" class="${cls.btnPrimario} w-full">Lançar</button>
        </div>
      </form>

      ${barraBuscaEOrdenacao()}

      <div class="flex items-center justify-between mb-2">
        <h3 id="contador-compras" class="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400"></h3>
      </div>

      <ul id="lista-compras" class="space-y-2"></ul>
    `

    const listaEl = abaEl.querySelector<HTMLElement>('#lista-compras')!
    const contadorEl = abaEl.querySelector<HTMLElement>('#contador-compras')!

    function atualizarListaCompras(): void {
      const termo = buscaLancamento.trim().toLowerCase()
      const filtradas = compras.filter(c => {
        if (!termo) return true
        const valorFormatado = formatarMoeda(c.valor).toLowerCase()
        const valorStr = String(c.valor)
        return (
          c.produto.toLowerCase().includes(termo) ||
          valorFormatado.includes(termo) ||
          valorStr.includes(termo)
        )
      })
      const ordenadas = ordenarItens(filtradas, ordemLancamento)

      contadorEl.textContent = `Produtos comprados (${ordenadas.length}${compras.length !== ordenadas.length ? ` de ${compras.length}` : ''})`

      if (ordenadas.length === 0) {
        listaEl.innerHTML = listaVazia(
          compras.length === 0
            ? 'Nenhum produto lançado para este cliente.'
            : 'Nenhum produto encontrado com os filtros atuais.'
        )
        return
      }

      listaEl.innerHTML = ordenadas
        .map(c =>
          itemLista({
            id: c.id,
            titulo: escaparHTML(c.produto),
            subtitulo: `📅 ${formatarData(c.data)}`,
            autoria: formatarAutoriaResumida(c),
            valor: c.valor,
            cor: 'rose',
          })
        )
        .join('')
    }

    conectarBuscaEOrdenacao(atualizarListaCompras)
    atualizarListaCompras()

    const form = abaEl.querySelector<HTMLFormElement>('#form-compra')!
    const produtoInput = abaEl.querySelector<HTMLInputElement>('#compra-produto')!
    const valorInput = abaEl.querySelector<HTMLInputElement>('#compra-valor')!
    const dataInput = abaEl.querySelector<HTMLInputElement>('#compra-data')!
    const boxAutocomplete = abaEl.querySelector<HTMLElement>('#autocomplete-produtos')!

    // Autocomplete do catálogo
    async function renderSugestoes(termo: string): Promise<void> {
      try {
        const sugestoes = await obterSugestoesCatalogo(termo)
        if (sugestoes.length === 0) {
          boxAutocomplete.classList.add('hidden')
          boxAutocomplete.innerHTML = ''
          return
        }

        boxAutocomplete.innerHTML = `
          <div class="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            💡 Sugestões mais usadas
          </div>
          ${sugestoes
            .map(
              (s, i) => `
            <button type="button" data-idx="${i}" class="btn-sugestao w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-800 transition flex items-center justify-between group">
              <div class="min-w-0 pr-2">
                <span class="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate block">${escaparHTML(s.produto)}</span>
                <span class="text-[10px] text-slate-400 dark:text-slate-500">usado ${s.frequencia}x</span>
              </div>
              <span class="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded-lg shrink-0">
                ${formatarMoeda(s.valorSugerido)}
              </span>
            </button>
          `
            )
            .join('')}
        `

        boxAutocomplete.classList.remove('hidden')

        boxAutocomplete.querySelectorAll<HTMLButtonElement>('.btn-sugestao').forEach(btn => {
          btn.addEventListener('mousedown', e => {
            e.preventDefault()
            const idx = Number(btn.dataset.idx)
            const item = sugestoes[idx]
            if (item) {
              produtoInput.value = item.produto
              valorInput.value = valorParaInput(item.valorSugerido)
              boxAutocomplete.classList.add('hidden')
              valorInput.focus()
              valorInput.select()
            }
          })
        })
      } catch {
        boxAutocomplete.classList.add('hidden')
      }
    }

    produtoInput.addEventListener('input', () => {
      renderSugestoes(produtoInput.value)
    })

    produtoInput.addEventListener('focus', () => {
      renderSugestoes(produtoInput.value)
    })

    produtoInput.addEventListener('blur', () => {
      setTimeout(() => {
        boxAutocomplete.classList.add('hidden')
      }, 150)
    })

    form.addEventListener('submit', async e => {
      e.preventDefault()
      boxAutocomplete.classList.add('hidden')
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
      try {
        const produto = produtoInput.value.trim()
        if (!produto) throw new Error('Informe o nome do produto')
        const valor = validarValor(valorInput.value)
        const data = validarData(dataInput.value)
        btn.disabled = true
        await criarCompra({ cliente_id: clienteId, produto, valor, data })
        toast.success('Produto lançado com sucesso!')
        form.reset()
        dataInput.value = hojeISO()
        await recarregarLancamentos()
        abaEl.querySelector<HTMLInputElement>('#compra-produto')?.focus()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao lançar produto'))
      } finally {
        btn.disabled = false
      }
    })

    abaEl.querySelector('#lista-compras')!.addEventListener('click', async e => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-editar],[data-excluir]')
      if (!alvo) return
      const id = alvo.dataset.editar ?? alvo.dataset.excluir!
      const compra = compras.find(c => c.id === id)
      if (!compra) return

      if (alvo.dataset.editar) {
        abrirFormModal({
          titulo: 'Editar produto',
          campos: [
            { nome: 'produto', label: 'Produto', tipo: 'text', valor: compra.produto, obrigatorio: true },
            { nome: 'valor', label: 'Valor (R$)', tipo: 'valor', valor: valorParaInput(compra.valor), obrigatorio: true },
            { nome: 'data', label: 'Data', tipo: 'date', valor: compra.data, obrigatorio: true },
          ],
          onSalvar: async v => {
            await atualizarCompra(compra.id, {
              produto: v.produto,
              valor: validarValor(v.valor),
              data: validarData(v.data),
            })
            toast.success('Produto atualizado!')
            await recarregarLancamentos()
          },
        })
        return
      }

      const ok = await confirmar({
        titulo: 'Excluir produto',
        mensagem: `Excluir <strong>${escaparHTML(compra.produto)}</strong> (${formatarMoeda(compra.valor)} em ${formatarData(compra.data)})?`,
      })
      if (!ok) return
      try {
        await excluirCompra(compra.id)
        toast.success('Produto excluído')
        await recarregarLancamentos()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao excluir produto'))
      }
    })
  }

  // ---------- Aba: Pagamentos (entradas) com Forma de Pagamento ----------
  function renderAbaPagamentos(): void {
    abaEl.innerHTML = `
      <form id="form-pagamento" novalidate class="grid grid-cols-2 sm:grid-cols-[1.2fr_1.3fr_1.2fr_1.8fr_auto] gap-2.5 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
        <div>
          <label class="${cls.label}" for="pagamento-valor">Valor pago (R$)</label>
          <input id="pagamento-valor" type="text" inputmode="decimal" class="${cls.input}" placeholder="0,00" autocomplete="off">
        </div>
        <div>
          <label class="${cls.label}" for="pagamento-forma">Forma de pgto</label>
          <select id="pagamento-forma" class="${cls.input} font-semibold">
            <option value="pix" selected>💠 PIX</option>
            <option value="dinheiro">💵 Dinheiro</option>
            <option value="credito">💳 Crédito</option>
            <option value="debito">💳 Débito</option>
            <option value="outro">🏷️ Outro</option>
          </select>
        </div>
        <div>
          <label class="${cls.label}" for="pagamento-data">Data</label>
          <input id="pagamento-data" type="date" class="${cls.input}" value="${hojeISO()}">
        </div>
        <div class="col-span-2 sm:col-span-1">
          <label class="${cls.label}" for="pagamento-descricao">Descrição (opcional)</label>
          <input id="pagamento-descricao" type="text" class="${cls.input}" placeholder="Ex: Parcela 1..." autocomplete="off" maxlength="200">
        </div>
        <div class="col-span-2 sm:col-span-1 flex items-end">
          <button type="submit" class="${cls.btnPrimario} w-full">Lançar</button>
        </div>
      </form>

      ${barraBuscaEOrdenacao()}

      <div class="flex items-center justify-between mb-2">
        <h3 id="contador-pagamentos" class="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400"></h3>
      </div>

      <ul id="lista-pagamentos" class="space-y-2"></ul>
    `

    const listaEl = abaEl.querySelector<HTMLElement>('#lista-pagamentos')!
    const contadorEl = abaEl.querySelector<HTMLElement>('#contador-pagamentos')!

    function atualizarListaPagamentos(): void {
      const termo = buscaLancamento.trim().toLowerCase()
      const filtrados = pagamentos.filter(p => {
        if (!termo) return true
        const desc = (p.descricao || '').toLowerCase()
        const valorFormatado = formatarMoeda(p.valor).toLowerCase()
        const valorStr = String(p.valor)
        const formaInfo = obterInfoFormaPagamento(p.forma_pagamento)
        return (
          desc.includes(termo) ||
          valorFormatado.includes(termo) ||
          valorStr.includes(termo) ||
          formaInfo.label.toLowerCase().includes(termo)
        )
      })
      const ordenados = ordenarItens(filtrados, ordemLancamento)

      contadorEl.textContent = `Pagamentos recebidos (${ordenados.length}${pagamentos.length !== ordenados.length ? ` de ${pagamentos.length}` : ''})`

      if (ordenados.length === 0) {
        listaEl.innerHTML = listaVazia(
          pagamentos.length === 0
            ? 'Nenhum pagamento lançado para este cliente.'
            : 'Nenhum pagamento encontrado com os filtros atuais.'
        )
        return
      }

      listaEl.innerHTML = ordenados
        .map(p => {
          const formaInfo = obterInfoFormaPagamento(p.forma_pagamento)
          const badgeForma = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${formaInfo.corBadge} border inline-flex items-center gap-1 shrink-0">${formaInfo.icone} ${formaInfo.label}</span>`

          return itemLista({
            id: p.id,
            titulo: p.descricao ? escaparHTML(p.descricao) : 'Pagamento',
            subtitulo: `📅 ${formatarData(p.data)}`,
            badgeExtra: badgeForma,
            autoria: formatarAutoriaResumida(p),
            valor: p.valor,
            cor: 'emerald',
          })
        })
        .join('')
    }

    conectarBuscaEOrdenacao(atualizarListaPagamentos)
    atualizarListaPagamentos()

    const form = abaEl.querySelector<HTMLFormElement>('#form-pagamento')!
    const valorInput = abaEl.querySelector<HTMLInputElement>('#pagamento-valor')!
    const formaSelect = abaEl.querySelector<HTMLSelectElement>('#pagamento-forma')!
    const dataInput = abaEl.querySelector<HTMLInputElement>('#pagamento-data')!
    const descInput = abaEl.querySelector<HTMLInputElement>('#pagamento-descricao')!

    form.addEventListener('submit', async e => {
      e.preventDefault()
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
      try {
        const valor = validarValor(valorInput.value)
        const data = validarData(dataInput.value)
        const forma_pagamento = formaSelect.value
        btn.disabled = true
        await criarPagamento({
          cliente_id: clienteId,
          valor,
          data,
          descricao: descInput.value,
          forma_pagamento,
        })
        toast.success('Pagamento lançado com sucesso!')
        form.reset()
        dataInput.value = hojeISO()
        formaSelect.value = 'pix'
        await recarregarLancamentos()
        abaEl.querySelector<HTMLInputElement>('#pagamento-valor')?.focus()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao lançar pagamento'))
      } finally {
        btn.disabled = false
      }
    })

    abaEl.querySelector('#lista-pagamentos')!.addEventListener('click', async e => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-editar],[data-excluir]')
      if (!alvo) return
      const id = alvo.dataset.editar ?? alvo.dataset.excluir!
      const pagamento = pagamentos.find(p => p.id === id)
      if (!pagamento) return

      if (alvo.dataset.editar) {
        abrirFormModal({
          titulo: 'Editar pagamento',
          campos: [
            { nome: 'valor', label: 'Valor pago (R$)', tipo: 'valor', valor: valorParaInput(pagamento.valor), obrigatorio: true },
            {
              nome: 'forma_pagamento',
              label: 'Forma de pagamento',
              tipo: 'select',
              valor: pagamento.forma_pagamento || 'pix',
              opcoes: [
                { valor: 'pix', label: '💠 PIX' },
                { valor: 'dinheiro', label: '💵 Dinheiro' },
                { valor: 'credito', label: '💳 Cartão de Crédito' },
                { valor: 'debito', label: '💳 Cartão de Débito' },
                { valor: 'outro', label: '🏷️ Outro' },
              ],
            },
            { nome: 'data', label: 'Data', tipo: 'date', valor: pagamento.data, obrigatorio: true },
            { nome: 'descricao', label: 'Descrição (opcional)', tipo: 'text', valor: pagamento.descricao ?? '' },
          ],
          onSalvar: async v => {
            await atualizarPagamento(pagamento.id, {
              valor: validarValor(v.valor),
              data: validarData(v.data),
              descricao: v.descricao,
              forma_pagamento: v.forma_pagamento,
            })
            toast.success('Pagamento atualizado!')
            await recarregarLancamentos()
          },
        })
        return
      }

      const ok = await confirmar({
        titulo: 'Excluir pagamento',
        mensagem: `Excluir o pagamento de <strong>${formatarMoeda(pagamento.valor)}</strong> em ${formatarData(pagamento.data)}?`,
      })
      if (!ok) return
      try {
        await excluirPagamento(pagamento.id)
        toast.success('Pagamento excluído')
        await recarregarLancamentos()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao excluir pagamento'))
      }
    })
  }

  renderSeletor()
  renderPainel()
  renderAbas()
}
