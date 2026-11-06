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
import type { Cliente, Compra, Pagamento } from '@/types'
import {
  escaparHTML,
  formatarAutoriaResumida,
  formatarData,
  formatarMoeda,
  hojeISO,
  linkWhatsApp,
  parseValor,
  valorParaInput,
} from '@/utils/format'
import { calcularResumo } from '@/utils/saldo'
import { enviarExtratoWhatsApp } from '@/utils/exportarPdf'
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
  try {
    ;[clientes, compras, pagamentos] = await Promise.all([
      listarClientes(),
      listarCompras(clienteId),
      listarPagamentos(clienteId),
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

  // ---------- Painel com saldo, autoria e botão de extrato WhatsApp ----------
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

    const linkWhatsTelefone = whats && c.telefone
      ? `<a href="${whats}" target="_blank" rel="noopener"
           class="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
           title="Abrir WhatsApp do cliente"
           aria-label="Abrir WhatsApp">
          <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
          <span>${escaparHTML(c.telefone)}</span>
        </a>`
      : `<span class="shrink-0 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">${c.telefone ? escaparHTML(c.telefone) : 'Sem telefone'}</span>`

    painelEl.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 mb-3.5 border-b border-slate-200/80 dark:border-white/10">
        <div class="min-w-0 flex-1 max-w-full">
          <span class="block text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">Cliente</span>
          <div class="flex items-center gap-2 min-w-0 max-w-full mt-0.5">
            <h2 class="text-base sm:text-lg font-black truncate min-w-0" title="${escaparHTML(c.nome)}">${escaparHTML(c.nome)}</h2>
            <span class="text-slate-300 dark:text-slate-600 shrink-0">•</span>
            ${linkWhatsTelefone}
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">${formatarAutoriaResumida(c)}</p>
        </div>

        <div class="flex items-center gap-2 flex-wrap shrink-0">
          <div class="flex items-center gap-2 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-1">
            <button id="btn-exportar-whatsapp" type="button" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-sm transition flex items-center gap-1.5" title="Enviar extrato para o WhatsApp">
              <span>📤 Enviar Extrato</span>
            </button>
            <label class="flex items-center gap-1.5 pr-2 text-xs font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer select-none" title="Marque para anexar o extrato em PDF">
              <input type="checkbox" id="check-anexar-pdf" checked class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 accent-emerald-600 cursor-pointer" />
              <span>PDF</span>
            </label>
          </div>
          <a href="#/historico" class="${cls.btnIcone}" title="Ver histórico de alterações">📜</a>
          <button id="editar-cliente" class="${cls.btnIcone}" title="Editar cliente">✏️</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div class="bg-emerald-50/80 border border-emerald-200 dark:bg-white/5 dark:border-emerald-500/20 rounded-2xl px-3 py-2.5 min-w-0">
          <span class="block text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-300 uppercase font-extrabold tracking-wide">↑ Entradas (pagos)</span>
          <span class="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">${formatarMoeda(totalPagamentos)}</span>
        </div>
        <div class="bg-rose-50/80 border border-rose-200 dark:bg-white/5 dark:border-rose-500/20 rounded-2xl px-3 py-2.5 min-w-0">
          <span class="block text-[10px] sm:text-[11px] text-rose-700 dark:text-rose-300 uppercase font-extrabold tracking-wide">↓ Saídas (compras)</span>
          <span class="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">${formatarMoeda(totalCompras)}</span>
        </div>
        <div class="col-span-2 bg-slate-50 border border-slate-200 dark:bg-white/10 dark:border-white/10 rounded-2xl px-3.5 py-3 flex items-center justify-between gap-2">
          <span class="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 uppercase font-extrabold tracking-wide">${rotuloSaldo}</span>
          <span class="text-xl sm:text-2xl font-black ${corSaldo}">${formatarMoeda(Math.abs(saldoDevedor))}</span>
        </div>
      </div>
    `

    painelEl.querySelector('#editar-cliente')!.addEventListener('click', () => {
      abrirEdicaoCliente(c, async () => {
        clientes = await listarClientes()
        cliente = clientes.find(x => x.id === clienteId) ?? cliente
        renderSeletor()
        renderPainel()
      })
    })

    painelEl.querySelector('#btn-exportar-whatsapp')!.addEventListener('click', async () => {
      const checkPdf = painelEl.querySelector<HTMLInputElement>('#check-anexar-pdf')
      const incluirPdf = checkPdf ? checkPdf.checked : false
      try {
        await enviarExtratoWhatsApp(c, compras, pagamentos, incluirPdf)
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao exportar extrato'))
      }
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
      const [novasCompras, novosPagamentos] = await Promise.all([
        listarCompras(clienteId),
        listarPagamentos(clienteId),
      ])
      compras = novasCompras
      pagamentos = novosPagamentos
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
          <p class="font-bold text-sm text-slate-900 dark:text-white truncate">${opts.titulo}</p>
          <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
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

  // ---------- Aba: Produtos comprados (saídas) ----------
  function renderAbaCompras(): void {
    abaEl.innerHTML = `
      <form id="form-compra" novalidate class="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2.5 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
        <div class="col-span-2 sm:col-span-1">
          <label class="${cls.label}" for="compra-produto">Produto</label>
          <input id="compra-produto" type="text" class="${cls.input}" placeholder="Ex: Creme hidratante" autocomplete="off" maxlength="160">
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

    form.addEventListener('submit', async e => {
      e.preventDefault()
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
      try {
        const produto = produtoInput.value.trim()
        if (!produto) throw new Error('Informe o nome do produto')
        const valor = validarValor(valorInput.value)
        const data = validarData(dataInput.value)
        btn.disabled = true
        await criarCompra({ cliente_id: clienteId, produto, valor, data })
        toast.success('Produto lançado com sucesso!')
        await recarregarLancamentos()
        abaEl.querySelector<HTMLInputElement>('#compra-produto')?.focus()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao lançar produto'))
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

  // ---------- Aba: Pagamentos (entradas) ----------
  function renderAbaPagamentos(): void {
    abaEl.innerHTML = `
      <form id="form-pagamento" novalidate class="grid grid-cols-2 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2.5 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
        <div>
          <label class="${cls.label}" for="pagamento-valor">Valor pago (R$)</label>
          <input id="pagamento-valor" type="text" inputmode="decimal" class="${cls.input}" placeholder="0,00" autocomplete="off">
        </div>
        <div>
          <label class="${cls.label}" for="pagamento-data">Data</label>
          <input id="pagamento-data" type="date" class="${cls.input}" value="${hojeISO()}">
        </div>
        <div class="col-span-2 sm:col-span-1">
          <label class="${cls.label}" for="pagamento-descricao">Descrição (opcional)</label>
          <input id="pagamento-descricao" type="text" class="${cls.input}" placeholder="Ex: Pix, dinheiro..." autocomplete="off" maxlength="200">
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
        return desc.includes(termo) || valorFormatado.includes(termo) || valorStr.includes(termo)
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
        .map(p =>
          itemLista({
            id: p.id,
            titulo: p.descricao ? escaparHTML(p.descricao) : 'Pagamento',
            subtitulo: `📅 ${formatarData(p.data)}`,
            autoria: formatarAutoriaResumida(p),
            valor: p.valor,
            cor: 'emerald',
          })
        )
        .join('')
    }

    conectarBuscaEOrdenacao(atualizarListaPagamentos)
    atualizarListaPagamentos()

    const form = abaEl.querySelector<HTMLFormElement>('#form-pagamento')!
    const valorInput = abaEl.querySelector<HTMLInputElement>('#pagamento-valor')!
    const dataInput = abaEl.querySelector<HTMLInputElement>('#pagamento-data')!
    const descInput = abaEl.querySelector<HTMLInputElement>('#pagamento-descricao')!

    form.addEventListener('submit', async e => {
      e.preventDefault()
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
      try {
        const valor = validarValor(valorInput.value)
        const data = validarData(dataInput.value)
        btn.disabled = true
        await criarPagamento({ cliente_id: clienteId, valor, data, descricao: descInput.value })
        toast.success('Pagamento lançado com sucesso!')
        await recarregarLancamentos()
        abaEl.querySelector<HTMLInputElement>('#pagamento-valor')?.focus()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao lançar pagamento'))
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
            { nome: 'data', label: 'Data', tipo: 'date', valor: pagamento.data, obrigatorio: true },
            { nome: 'descricao', label: 'Descrição (opcional)', tipo: 'text', valor: pagamento.descricao ?? '' },
          ],
          onSalvar: async v => {
            await atualizarPagamento(pagamento.id, {
              valor: validarValor(v.valor),
              data: validarData(v.data),
              descricao: v.descricao,
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
