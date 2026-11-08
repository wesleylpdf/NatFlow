import { abrirFormModal, confirmar, criarOverlay } from '@/components/Modal'
import { abrirEdicaoCliente } from '@/components/ClientesView'
import { listarClientes } from '@/services/clientes'
import { atualizarCompra, criarCompra, excluirCompra, listarCompras } from '@/services/compras'
import {
  atualizarPagamento,
  criarPagamento,
  excluirPagamento,
  listarPagamentos,
} from '@/services/pagamentos'
import {
  listarAcertos,
  criarAcerto,
  criarMultiplosAcertos,
  atualizarAcerto,
  excluirAcerto,
  alternarStatusAcerto,
  abaterAcertosComPagamento,
  limparAcertosPendentes,
  restaurarAcertoDePagamentoExcluido,
  reajustarDescricoesParcelas,
  parseDescricaoParcela,
  formatarDescricaoParcela,
} from '@/services/acertos'
import { carregarMapaMembros, obterPerfilAtual } from '@/services/equipe'
import { obterSugestoesCatalogo } from '@/services/catalogo'
import type { Cliente, Compra, Pagamento, Autorizado, Acerto } from '@/types'
import {
  calcularDataFutura,
  calcularDiasAtraso,
  escaparHTML,
  extrairPrimeiroNome,
  formatarAutoriaResumida,
  formatarData,
  formatarMoeda,
  hojeISO,
  linkWhatsApp,
  obterInfoFormaPagamento,
  obterStatusPromessa,
  parseValor,
  valorParaInput,
} from '@/utils/format'
import { calcularResumo } from '@/utils/saldo'
import {
  abrirModalOpcoesExtrato,
  enviarLembreteAcertoWhatsApp,
  enviarLembreteCobrancaWhatsApp,
  enviarReciboPagamentoWhatsApp,
} from '@/utils/exportarPdf'
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
  let acertos: Acerto[] = []
  let perfil: Autorizado | null = null
  let mapaMembros = new Map<string, string>()

  try {
    ;[clientes, compras, pagamentos, acertos, perfil, mapaMembros] = await Promise.all([
      listarClientes(),
      listarCompras(clienteId),
      listarPagamentos(clienteId),
      listarAcertos(clienteId),
      obterPerfilAtual(),
      carregarMapaMembros(),
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

    const acertosPendentes = acertos
      .filter(a => a.status === 'pendente')
      .sort((a, b) => a.data.localeCompare(b.data))
    const acertosPagos = acertos
      .filter(a => a.status === 'pago')
      .sort((a, b) => b.data.localeCompare(a.data))
    const totalAgendadoPendente = acertosPendentes.reduce((acc, a) => acc + a.valor, 0)
    const totalAgendadoPago = acertosPagos.reduce((acc, a) => acc + a.valor, 0)

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
           class="shrink-0 inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
           title="Abrir WhatsApp do cliente"
           aria-label="Abrir WhatsApp">
          <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.66 20.16 9.3 19.8 8.1 19.11L7.81 18.94L4.7 19.76L5.53 16.73L5.34 16.43C4.56 15.19 4.14 13.57 4.14 11.92C4.15 7.38 7.84 3.67 12.05 3.67M9.54 7.39C9.37 7.39 9.1 7.45 8.87 7.7C8.63 7.96 7.96 8.59 7.96 9.87C7.96 11.15 8.89 12.39 9.02 12.56C9.15 12.73 10.82 15.31 13.4 16.42C14.02 16.68 14.5 16.84 14.88 16.96C15.5 17.16 16.06 17.13 16.51 17.06C17.01 16.99 18.06 16.43 18.28 15.81C18.5 15.19 18.5 14.65 18.43 14.54C18.37 14.43 18.19 14.37 17.92 14.23C17.65 14.1 16.36 13.47 16.12 13.38C15.88 13.29 15.71 13.25 15.53 13.51C15.36 13.78 14.86 14.37 14.71 14.54C14.56 14.71 14.41 14.73 14.14 14.6C13.87 14.46 13.01 14.18 11.99 13.27C11.19 12.56 10.65 11.68 10.49 11.41C10.34 11.15 10.47 11 10.61 10.87C10.73 10.75 10.87 10.56 11.01 10.4C11.15 10.23 11.2 10.11 11.29 9.93C11.38 9.75 11.33 9.6 11.26 9.47C11.2 9.34 10.69 8.08 10.48 7.57C10.27 7.07 10.06 7.14 9.9 7.13C9.74 7.12 9.54 7.39 9.54 7.39Z"/>
          </svg>
          ${escaparHTML(c.telefone)}
        </a>`
      : `<span class="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 shrink-0">${c.telefone ? escaparHTML(c.telefone) : 'Sem telefone'}</span>`

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
      <div class="mb-3 space-y-1.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">${escaparHTML(c.nome)}</h2>
            <button id="btn-editar-cliente" class="${cls.btnIcone}" title="Editar cliente">✏️</button>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            ${btnCobrarWhatsApp}
            <button id="btn-extrato-whats" type="button"
              class="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm transition"
              title="Baixar PDF e enviar extrato completo para o cliente no WhatsApp">
              📄 Extrato
            </button>
          </div>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2 flex-nowrap whitespace-nowrap min-w-0 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
          ${linkWhatsTelefone}
          <span class="text-slate-400 dark:text-slate-500 shrink-0">•</span>
          <span class="font-medium shrink-0 whitespace-nowrap">${formatarAutoriaResumida(c, mapaMembros)}</span>
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

      <!-- Cronograma de Acertos -->
      <div class="mt-3.5 pt-3 border-t border-slate-200 dark:border-white/10 space-y-2.5">
        <!-- Título acima -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">🗓️ Cronograma de Acertos</span>
            ${
              acertosPendentes.length > 0
                ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    ${acertosPendentes.length} pendente${acertosPendentes.length > 1 ? 's' : ''}
                  </span>`
                : ''
            }
          </div>
        </div>

        <!-- Botões na mesma linha sem quebrar -->
        <div class="flex items-center gap-2">
          ${
            saldoDevedor > 0
              ? `<button id="btn-parcelar-saldo" type="button" class="flex-1 inline-flex items-center justify-center gap-1 text-[11px] sm:text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 transition active:scale-95 whitespace-nowrap" title="Dividir saldo devedor em 2x, 3x ou mais">
                  ➗ Parcelar Saldo
                </button>`
              : ''
          }
          <button id="btn-novo-acerto" type="button" class="flex-1 inline-flex items-center justify-center gap-1 text-[11px] sm:text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition active:scale-95 whitespace-nowrap" title="Adicionar nova data e valor combinado">
            ➕ Novo Acerto
          </button>
        </div>

        ${
          acertos.length === 0
            ? `
              <div class="p-3 rounded-2xl bg-slate-50/70 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 text-center">
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Nenhum acerto agendado no momento. Use os botões acima para <strong>Parcelar Saldo</strong> ou agendar um <strong>Novo Acerto</strong>.</span>
              </div>
            `
            : `
              <div class="space-y-1.5">
                ${[...acertosPendentes, ...acertosPagos]
                  .map(a => {
                    const pago = a.status === 'pago'
                    const infoPromessa = !pago ? obterStatusPromessa(a.data) : null
                    const badgeStatus = pago
                      ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">✅ Quitado</span>`
                      : `<span class="text-[10px] font-black px-2 py-0.5 rounded-full border ${infoPromessa?.corBadge || ''}">${infoPromessa?.rotulo || formatarData(a.data)}</span>`

                    return `
                      <div class="flex items-center justify-between gap-2 p-2 sm:px-3 sm:py-2 rounded-xl transition ${
                        pago
                          ? 'bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 opacity-70'
                          : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                      }">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <button type="button" ${pago ? `data-alternar-acerto="${a.id}"` : `data-quitar-acerto="${a.id}"`} class="text-base shrink-0 hover:scale-125 transition active:scale-95 cursor-pointer" title="${pago ? 'Clique para reabrir este acerto' : 'Clique para quitar esta parcela'}">
                            ${pago ? '✅' : '⭕'}
                          </button>
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="text-xs font-black ${pago ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}">
                                ${formatarMoeda(a.valor)}
                              </span>
                              ${badgeStatus}
                            </div>
                            ${a.descricao ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${escaparHTML(a.descricao)}</p>` : ''}
                          </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          ${
                            !pago
                              ? `
                                <button type="button" data-cobrar-acerto="${a.id}" class="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition shadow-xs cursor-pointer" title="Lembrar esta parcela no WhatsApp com PIX">
                                  <span class="text-xs">💬</span>
                                </button>
                                <button type="button" data-quitar-acerto="${a.id}" class="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition shadow-xs cursor-pointer" title="Quitar este acerto e registrar pagamento">
                                  <span>💰</span>
                                  <span>Quitar</span>
                                </button>
                              `
                              : ''
                          }
                          <button data-editar-acerto="${a.id}" class="${cls.btnIcone} text-xs" title="Editar acerto">✏️</button>
                          <button data-excluir-acerto="${a.id}" class="${cls.btnIcone} text-xs text-rose-500 hover:text-rose-600" title="Excluir acerto">🗑️</button>
                        </div>
                      </div>
                    `
                  })
                  .join('')}

                ${
                  acertos.length > 0
                    ? `
                    <div class="space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-white/10">
                      <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 font-semibold">
                        <span>Total em Acertos (${acertos.length}): <strong class="text-slate-800 dark:text-slate-200">${formatarMoeda(totalAgendadoPendente + totalAgendadoPago)}</strong></span>
                        <span>Pendente: <strong class="text-amber-600 dark:text-amber-400">${formatarMoeda(totalAgendadoPendente)}</strong></span>
                      </div>
                      ${
                        saldoDevedor > 0 && Math.abs(saldoDevedor - totalAgendadoPendente) >= 0.01
                          ? saldoDevedor > totalAgendadoPendente
                            ? `<div class="text-[11px] text-amber-700 dark:text-amber-300 font-bold px-1 flex items-center justify-between">
                                 <span>⚠️ Restante do saldo: <strong>${formatarMoeda(saldoDevedor - totalAgendadoPendente)}</strong> ainda sem acerto</span>
                               </div>`
                            : `<div class="text-[11px] text-sky-700 dark:text-sky-300 font-bold px-1 flex items-center justify-between gap-1 flex-wrap">
                                 <span>ℹ️ Acertos somam <strong>+${formatarMoeda(totalAgendadoPendente - saldoDevedor)}</strong> a mais que o saldo devedor</span>
                                 <button id="btn-ajustar-saldo-acertos" type="button" class="text-[10px] font-black px-2 py-0.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 active:scale-95 text-sky-800 dark:text-sky-300 border border-sky-500/30 transition cursor-pointer" title="Redistribuir o saldo devedor atual igualmente entre as parcelas pendentes">
                                   ⚖️ Ajustar ao Saldo
                                 </button>
                               </div>`
                          : ''
                      }
                    </div>
                  `
                    : ''
                }
              </div>
            `
        }
      </div>
    `

    function abrirModalNovoAcerto(): void {
      const { saldoDevedor } = calcularResumo(compras, pagamentos)
      abrirFormModal({
        titulo: 'Novo Acerto Combinado',
        campos: [
          {
            nome: 'data',
            label: 'Data combinada para pagamento',
            tipo: 'date',
            valor: hojeISO(),
            obrigatorio: true,
          },
          {
            nome: 'valor',
            label: 'Valor previsto (R$)',
            tipo: 'valor',
            valor: saldoDevedor > 0 ? valorParaInput(saldoDevedor) : '0,00',
            obrigatorio: true,
          },
          {
            nome: 'descricao',
            label: 'Descrição / Identificação (opcional)',
            tipo: 'text',
            valor: '',
          },
        ],
        onSalvar: async v => {
          await criarAcerto({
            cliente_id: clienteId,
            data: validarData(v.data),
            valor: validarValor(v.valor),
            descricao: v.descricao,
          })
          toast.success('Acerto agendado com sucesso!')
          await recarregarLancamentos()
        },
      })
    }

    function abrirModalEditarAcerto(acerto: Acerto): void {
      abrirFormModal({
        titulo: 'Editar Acerto Combinado',
        campos: [
          {
            nome: 'data',
            label: 'Data prevista',
            tipo: 'date',
            valor: acerto.data,
            obrigatorio: true,
          },
          {
            nome: 'valor',
            label: 'Valor previsto (R$)',
            tipo: 'valor',
            valor: valorParaInput(acerto.valor),
            obrigatorio: true,
          },
          {
            nome: 'descricao',
            label: 'Descrição / Identificação (opcional)',
            tipo: 'text',
            valor: acerto.descricao || '',
          },
        ],
        onSalvar: async v => {
          await atualizarAcerto(acerto.id, clienteId, {
            data: validarData(v.data),
            valor: validarValor(v.valor),
            descricao: v.descricao,
          })
          toast.success('Acerto atualizado!')
          await recarregarLancamentos()
        },
      })
    }

    function abrirModalParcelamento(): void {
      const { saldoDevedor } = calcularResumo(compras, pagamentos)
      const valorSugerido = saldoDevedor > 0 ? saldoDevedor : 0

      const overlay = criarOverlay(`
        <div class="space-y-4 max-w-lg mx-auto">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">➗ Parcelar Saldo</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gere as parcelas e personalize as datas ou valores individualmente antes de agendar.
              </p>
            </div>
            <button type="button" data-fechar class="${cls.btnIcone} text-lg" title="Fechar">✕</button>
          </div>

          <form id="form-parcelamento" novalidate class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="${cls.label}" for="parc-valor-total">Valor Total a Parcelar (R$)</label>
                <input id="parc-valor-total" type="text" inputmode="decimal" class="${cls.input} font-black" value="${valorParaInput(valorSugerido)}" required autocomplete="off">
              </div>
              <div>
                <label class="${cls.label}" for="parc-qtd">Quantidade de Parcelas</label>
                <select id="parc-qtd" class="${cls.input} font-bold">
                  <option value="2">2x</option>
                  <option value="3" selected>3x</option>
                  <option value="4">4x</option>
                  <option value="5">5x</option>
                  <option value="6">6x</option>
                  <option value="10">10x</option>
                  <option value="12">12x</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="${cls.label}" for="parc-intervalo">Intervalo entre parcelas</label>
                <select id="parc-intervalo" class="${cls.input} font-bold">
                  <option value="mensal" selected>🗓️ Mensal (a cada 30 dias)</option>
                  <option value="quinzenal">🗓️ Quinzenal (a cada 15 dias)</option>
                  <option value="semanal">🗓️ Semanal (a cada 7 dias)</option>
                </select>
              </div>
              <div>
                <label class="${cls.label}" for="parc-data-primeira">Data da 1ª Parcela</label>
                <input id="parc-data-primeira" type="date" class="${cls.input} font-bold" value="${calcularDataFutura(hojeISO(), 'mensal', 1)}" required>
              </div>
            </div>

            <div>
              <label class="${cls.label}" for="parc-prefixo-desc">Identificação base (opcional)</label>
              <input id="parc-prefixo-desc" type="text" class="${cls.input}" placeholder="Ex: Compra do ciclo..." maxlength="80">
            </div>

            <!-- Lista Editável das Parcelas -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div class="flex items-center justify-between">
                <span class="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Parcelas (edite datas e valores livremente)
                </span>
                <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">✏️ editável</span>
              </div>
              <div id="parc-preview-lista" class="space-y-2 max-h-56 overflow-y-auto pr-1"></div>
              
              <div id="parc-rodape-total" class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-bold pt-2 border-t border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
                <div class="flex items-center gap-2">
                  <span>Soma: <strong id="parc-soma-atual" class="font-black text-slate-900 dark:text-white">R$ 0,00</strong></span>
                  <span id="parc-status-diferenca" class="text-[11px]"></span>
                </div>
                <button type="button" id="btn-redistribuir-valores" class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer text-left sm:text-right" title="Dividir o valor total igualmente entre as parcelas na tela">
                  ⚖️ Redistribuir total igualmente
                </button>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" data-fechar class="${cls.btnSecundario}">Cancelar</button>
              <button type="submit" id="btn-salvar-parcelamento" class="${cls.btnPrimario}">
                Confirmar e Agendar Parcelas
              </button>
            </div>
          </form>
        </div>
      `)

      const fechar = (): void => overlay.remove()
      overlay.querySelector('[data-fechar]')?.addEventListener('click', fechar)
      overlay.querySelectorAll<HTMLButtonElement>('button[data-fechar]').forEach(b => b.addEventListener('click', fechar))

      const form = overlay.querySelector<HTMLFormElement>('#form-parcelamento')!
      const inputTotal = overlay.querySelector<HTMLInputElement>('#parc-valor-total')!
      const selectQtd = overlay.querySelector<HTMLSelectElement>('#parc-qtd')!
      const selectIntervalo = overlay.querySelector<HTMLSelectElement>('#parc-intervalo')!
      const inputDataPrimeira = overlay.querySelector<HTMLInputElement>('#parc-data-primeira')!
      const inputDesc = overlay.querySelector<HTMLInputElement>('#parc-prefixo-desc')!
      const previewEl = overlay.querySelector<HTMLElement>('#parc-preview-lista')!
      const somaSituacaoEl = overlay.querySelector<HTMLElement>('#parc-soma-atual')!
      const diffSituacaoEl = overlay.querySelector<HTMLElement>('#parc-status-diferenca')!

      function atualizarSomaRodape(): void {
        const linhas = previewEl.querySelectorAll<HTMLElement>('.item-parcela-linha')
        let soma = 0
        linhas.forEach(l => {
          const valInput = l.querySelector<HTMLInputElement>('.input-parc-valor')
          if (valInput && valInput.value) {
            const v = parseValor(valInput.value)
            if (!isNaN(v) && v > 0) soma += v
          }
        })

        const totalInformado = parseValor(inputTotal.value) || 0
        somaSituacaoEl.textContent = formatarMoeda(soma)

        const diff = Math.round((soma - totalInformado) * 100) / 100
        if (Math.abs(diff) < 0.01) {
          diffSituacaoEl.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-extrabold">✓ 100% distribuído</span>`
        } else if (diff > 0) {
          diffSituacaoEl.innerHTML = `<span class="text-amber-600 dark:text-amber-400 font-bold">+${formatarMoeda(diff)} a mais que o total</span>`
        } else {
          diffSituacaoEl.innerHTML = `<span class="text-amber-600 dark:text-amber-400 font-bold">${formatarMoeda(Math.abs(diff))} a distribuir</span>`
        }
      }

      function regenerarLinhas(): void {
        const total = parseValor(inputTotal.value)
        if (isNaN(total) || total <= 0) {
          previewEl.innerHTML = `<p class="text-xs text-rose-500 font-bold p-2">Informe um valor total válido maior que zero.</p>`
          somaSituacaoEl.textContent = formatarMoeda(0)
          diffSituacaoEl.innerHTML = ''
          return
        }

        const qtd = parseInt(selectQtd.value, 10) || 1
        const intervalo = selectIntervalo.value as 'quinzenal' | 'mensal' | 'semanal'
        const dataInicio = inputDataPrimeira.value || hojeISO()
        const descPrefixo = inputDesc.value.trim()

        const valorCentavos = Math.round(total * 100)
        const baseCentavos = Math.floor(valorCentavos / qtd)
        const restoCentavos = valorCentavos - baseCentavos * qtd

        previewEl.innerHTML = Array.from({ length: qtd }, (_, i) => {
          const valorItem = (i === 0 ? baseCentavos + restoCentavos : baseCentavos) / 100
          const dataItem = calcularDataFutura(dataInicio, intervalo, i)
          const descItem = descPrefixo ? `${descPrefixo} (${i + 1}/${qtd})` : `Parcela ${i + 1}/${qtd}`

          return `
            <div class="item-parcela-linha p-2 rounded-xl bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600/80 space-y-1.5" data-idx="${i}">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-black text-indigo-700 dark:text-indigo-300 numero-parcela-badge">#${i + 1}</span>
                <input type="text" class="${cls.input} text-xs py-1 px-2 font-medium flex-1 min-w-0 input-parc-desc" value="${escaparHTML(descItem)}" placeholder="Descrição">
                <button type="button" class="btn-remover-linha-preview text-slate-400 hover:text-rose-500 font-black text-xs px-1.5 py-0.5 rounded transition cursor-pointer" title="Remover esta parcela">✕</button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">🗓️ Data</label>
                  <input type="date" class="${cls.input} text-xs py-1.5 px-2 font-bold input-parc-data" value="${dataItem}" required>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">💰 Valor (R$)</label>
                  <input type="text" inputmode="decimal" class="${cls.input} text-xs py-1.5 px-2 font-black text-right input-parc-valor" value="${valorParaInput(valorItem)}" required autocomplete="off">
                </div>
              </div>
            </div>
          `
        }).join('')

        previewEl.querySelectorAll<HTMLInputElement>('.input-parc-valor').forEach(input => {
          input.addEventListener('input', atualizarSomaRodape)
        })

        atualizarSomaRodape()
      }

      previewEl.addEventListener('click', e => {
        const btnRemover = (e.target as HTMLElement).closest<HTMLButtonElement>('.btn-remover-linha-preview')
        if (btnRemover) {
          const linha = btnRemover.closest<HTMLElement>('.item-parcela-linha')
          if (!linha) return

          const linhasAtuais = previewEl.querySelectorAll<HTMLElement>('.item-parcela-linha')
          if (linhasAtuais.length <= 1) {
            toast.warning('O parcelamento deve conter pelo menos 1 parcela.')
            return
          }

          linha.remove()

          // Renumera as linhas que restaram
          const linhasRestantes = previewEl.querySelectorAll<HTMLElement>('.item-parcela-linha')
          const novoTotal = linhasRestantes.length
          const descPref = inputDesc.value.trim()

          linhasRestantes.forEach((l, idx) => {
            const badge = l.querySelector('.numero-parcela-badge')
            if (badge) badge.textContent = `#${idx + 1}`

            const descInput = l.querySelector<HTMLInputElement>('.input-parc-desc')
            if (descInput) {
              const info = parseDescricaoParcela(descInput.value)
              if (info) {
                descInput.value = formatarDescricaoParcela(info.prefixo || descPref, info.temParenteses, idx + 1, novoTotal)
              } else if (!descInput.value.trim() || descInput.value.startsWith('Parcela ')) {
                descInput.value = descPref ? `${descPref} (${idx + 1}/${novoTotal})` : `Parcela ${idx + 1}/${novoTotal}`
              }
            }
          })

          atualizarSomaRodape()
        }
      })

      overlay.querySelector('#btn-redistribuir-valores')?.addEventListener('click', () => {
        const total = parseValor(inputTotal.value)
        if (isNaN(total) || total <= 0) return

        const linhasRestantes = previewEl.querySelectorAll<HTMLElement>('.item-parcela-linha')
        const qtdRest = linhasRestantes.length
        if (qtdRest === 0) return

        const valorCentavos = Math.round(total * 100)
        const baseCentavos = Math.floor(valorCentavos / qtdRest)
        const restoCentavos = valorCentavos - baseCentavos * qtdRest

        linhasRestantes.forEach((l, i) => {
          const valItem = (i === 0 ? baseCentavos + restoCentavos : baseCentavos) / 100
          const valInput = l.querySelector<HTMLInputElement>('.input-parc-valor')
          if (valInput) valInput.value = valorParaInput(valItem)
        })

        atualizarSomaRodape()
        toast.info(`Valor redistribuído em ${qtdRest} parcelas iguais.`)
      })

      inputTotal.addEventListener('input', regenerarLinhas)
      selectQtd.addEventListener('change', regenerarLinhas)
      inputDataPrimeira.addEventListener('input', regenerarLinhas)
      inputDesc.addEventListener('input', regenerarLinhas)

      selectIntervalo.addEventListener('change', () => {
        const intervalo = selectIntervalo.value as 'quinzenal' | 'mensal' | 'semanal'
        inputDataPrimeira.value = calcularDataFutura(hojeISO(), intervalo, 1)
        regenerarLinhas()
      })

      regenerarLinhas()

      form.addEventListener('submit', async e => {
        e.preventDefault()
        const linhas = previewEl.querySelectorAll<HTMLElement>('.item-parcela-linha')
        if (linhas.length === 0) {
          toast.warning('Nenhuma parcela gerada.')
          return
        }

        const parcelas: { data: string; valor: number; descricao: string }[] = []
        try {
          linhas.forEach((linha, i) => {
            const dataVal = linha.querySelector<HTMLInputElement>('.input-parc-data')?.value || ''
            const valorVal = linha.querySelector<HTMLInputElement>('.input-parc-valor')?.value || ''
            const descVal = linha.querySelector<HTMLInputElement>('.input-parc-desc')?.value.trim() || `Parcela ${i + 1}`

            const data = validarData(dataVal)
            const valor = validarValor(valorVal)
            parcelas.push({ data, valor, descricao: descVal })
          })
        } catch (err) {
          toast.error(mensagemErro(err, 'Verifique as datas e valores informados nas parcelas'))
          return
        }

        const btnSalvar = form.querySelector<HTMLButtonElement>('#btn-salvar-parcelamento')!
        btnSalvar.disabled = true
        try {
          await criarMultiplosAcertos(clienteId, parcelas)
          toast.success(`${parcelas.length} parcelas agendadas com sucesso!`)
          fechar()
          await recarregarLancamentos()
        } catch (err) {
          toast.error(mensagemErro(err, 'Erro ao agendar parcelas'))
        } finally {
          btnSalvar.disabled = false
        }
      })
    }

    function abrirModalQuitacaoAcerto(acerto: Acerto): void {
      const overlay = criarOverlay(`
        <div class="space-y-3.5 max-w-md mx-auto">
          <div class="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
                💰
              </div>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">
                  Quitar Parcela / Acerto
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Confirmar recebimento e dar baixa no cronograma.
                </p>
              </div>
            </div>
            <button type="button" data-fechar class="${cls.btnIcone} text-lg shrink-0" title="Fechar">✕</button>
          </div>

          <!-- Resumo da parcela -->
          <div class="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2">
            <div>
              <span class="block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                ${escaparHTML(acerto.descricao || 'Acerto combinado')}
              </span>
              <span class="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Vencimento: <strong>${formatarData(acerto.data)}</strong>
              </span>
            </div>
            <span class="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
              ${formatarMoeda(acerto.valor)}
            </span>
          </div>

          <!-- Aviso do que será feito -->
          <div class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2 text-xs text-slate-700 dark:text-slate-200">
            <div class="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <span>📋</span>
              <span>O que será feito ao confirmar:</span>
            </div>
            <ul class="space-y-1.5 pl-1 text-[11px] sm:text-xs">
              <li class="flex items-start gap-1.5">
                <span class="text-emerald-600 font-black shrink-0">✓</span>
                <span>Lança um <strong>pagamento de ${formatarMoeda(acerto.valor)}</strong> no histórico financeiro de <strong>${escaparHTML(c.nome)}</strong>.</span>
              </li>
              <li class="flex items-start gap-1.5">
                <span class="text-emerald-600 font-black shrink-0">✓</span>
                <span>O saldo devedor do cliente será <strong>abatido em ${formatarMoeda(acerto.valor)}</strong>.</span>
              </li>
              <li class="flex items-start gap-1.5">
                <span class="text-emerald-600 font-black shrink-0">✓</span>
                <span>Esta parcela será <strong>baixada e removida</strong> do Cronograma de Acertos.</span>
              </li>
            </ul>
          </div>

          <!-- Forma de Pagamento -->
          <div class="space-y-1">
            <label class="${cls.label}" for="forma-quitacao-acerto">Forma de recebimento</label>
            <select id="forma-quitacao-acerto" class="${cls.input} font-bold text-xs py-2">
              <option value="pix" selected>💠 PIX</option>
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="credito">💳 Cartão de Crédito</option>
              <option value="debito">💳 Cartão de Débito</option>
              <option value="outro">🏷️ Outro</option>
            </select>
          </div>

          <!-- Botões de Ação: Cancelar e Confirmar -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button type="button" data-fechar class="${cls.btnSecundario} text-xs py-2 px-3">
              Cancelar
            </button>
            <button type="button" id="btn-confirmar-quitacao" class="${cls.btnPrimario} text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer">
              <span>✓</span>
              <span>Confirmar Quitação</span>
            </button>
          </div>
        </div>
      `)

      const fechar = (): void => overlay.remove()
      overlay.querySelectorAll('[data-fechar]').forEach(btn => btn.addEventListener('click', fechar))

      overlay.addEventListener('click', e => {
        if (e.target === overlay) fechar()
      })

      const onKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          fechar()
          document.removeEventListener('keydown', onKey)
        }
      }
      document.addEventListener('keydown', onKey)

      const btnConfirmar = overlay.querySelector<HTMLButtonElement>('#btn-confirmar-quitacao')!
      const formaSelect = overlay.querySelector<HTMLSelectElement>('#forma-quitacao-acerto')!

      btnConfirmar.addEventListener('click', async () => {
        btnConfirmar.disabled = true
        btnConfirmar.textContent = 'Quitando...'
        try {
          await criarPagamento({
            cliente_id: clienteId,
            valor: acerto.valor,
            data: hojeISO(),
            descricao: acerto.descricao || 'Quitação de parcela',
            forma_pagamento: formaSelect.value,
          })

          await excluirAcerto(acerto.id, clienteId)

          toast.success(`Parcela de ${formatarMoeda(acerto.valor)} quitada com sucesso! 🎉`)
          fechar()
          await recarregarLancamentos()
        } catch (err) {
          toast.error(mensagemErro(err, 'Erro ao quitar parcela'))
          btnConfirmar.disabled = false
          btnConfirmar.textContent = 'Confirmar Quitação'
        }
      })
    }

    painelEl.querySelector('#btn-parcelar-saldo')?.addEventListener('click', abrirModalParcelamento)
    painelEl.querySelector('#btn-novo-acerto')?.addEventListener('click', abrirModalNovoAcerto)

    painelEl.querySelector('#btn-ajustar-saldo-acertos')?.addEventListener('click', async () => {
      const { saldoDevedor } = calcularResumo(compras, pagamentos)
      if (saldoDevedor <= 0 || acertosPendentes.length === 0) return

      const ok = await confirmar({
        titulo: 'Ajustar Parcelas ao Saldo Devedor',
        mensagem: `O saldo devedor atual é de ${formatarMoeda(saldoDevedor)}, mas as ${acertosPendentes.length} parcelas agendadas somam ${formatarMoeda(totalAgendadoPendente)}. Deseja redistribuir o saldo devedor igualmente entre as parcelas?`,
        textoConfirmar: 'Ajustar Parcelas',
      })
      if (!ok) return

      try {
        const qtd = acertosPendentes.length
        const valorBase = Math.floor((saldoDevedor / qtd) * 100) / 100
        const diferencaCentavos = Math.round((saldoDevedor - valorBase * qtd) * 100)

        for (let i = 0; i < qtd; i++) {
          const centavoExtra = i < diferencaCentavos ? 0.01 : 0
          const novoValor = Math.round((valorBase + centavoExtra) * 100) / 100
          await atualizarAcerto(acertosPendentes[i].id, clienteId, { valor: novoValor })
        }

        toast.success(`Parcelas ajustadas com sucesso para o saldo de ${formatarMoeda(saldoDevedor)}! 🎉`)
        await recarregarLancamentos()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao ajustar parcelas'))
      }
    })

    painelEl.querySelectorAll<HTMLElement>('[data-cobrar-acerto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cobrarAcerto!
        const acerto = acertos.find(a => a.id === id)
        if (!acerto || !cliente) return
        const opcoesPix = {
          chavePix: perfil?.chave_pix,
          nomeProfissional: perfil?.beneficiario_pix || perfil?.nome,
        }
        enviarLembreteAcertoWhatsApp(cliente, acerto, opcoesPix)
      })
    })

    painelEl.querySelectorAll<HTMLElement>('[data-quitar-acerto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.quitarAcerto!
        const acerto = acertos.find(a => a.id === id)
        if (acerto) abrirModalQuitacaoAcerto(acerto)
      })
    })

    painelEl.querySelectorAll<HTMLElement>('[data-alternar-acerto]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.alternarAcerto!
        const acerto = acertos.find(a => a.id === id)
        if (!acerto) return
        if (acerto.status === 'pendente') {
          abrirModalQuitacaoAcerto(acerto)
          return
        }
        try {
          await alternarStatusAcerto(id, clienteId, false)
          toast.info('Acerto reaberto como pendente.')
          await recarregarLancamentos()
        } catch (err) {
          toast.error(mensagemErro(err, 'Erro ao reabrir acerto'))
        }
      })
    })

    painelEl.querySelectorAll<HTMLElement>('[data-editar-acerto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editarAcerto!
        const acerto = acertos.find(a => a.id === id)
        if (acerto) abrirModalEditarAcerto(acerto)
      })
    })

    painelEl.querySelectorAll<HTMLElement>('[data-excluir-acerto]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.excluirAcerto!
        const acerto = acertos.find(a => a.id === id)
        if (!acerto) return
        const ok = await confirmar({
          titulo: 'Excluir acerto',
          mensagem: `Excluir o acerto de <strong>${formatarMoeda(acerto.valor)}</strong> previsto para ${formatarData(acerto.data)}?`,
          textoConfirmar: 'Excluir',
        })
        if (!ok) return
        try {
          await excluirAcerto(id, clienteId)
          toast.success('Acerto excluído com sucesso.')
          await recarregarLancamentos()
        } catch (err) {
          toast.error(mensagemErro(err, 'Erro ao excluir acerto'))
        }
      })
    })

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
        nomeProfissional: perfil?.beneficiario_pix || perfil?.nome,
      }
      abrirModalOpcoesExtrato(cliente!, compras, pagamentos, opcoesPix)
    })

    painelEl.querySelector('#btn-cobrar-whatsapp')?.addEventListener('click', () => {
      const opcoesPix = {
        chavePix: perfil?.chave_pix,
        nomeProfissional: perfil?.beneficiario_pix || perfil?.nome,
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
      const [novasCompras, novosPagamentos, novosAcertos, novoPerfil, novosClientes] = await Promise.all([
        listarCompras(clienteId),
        listarPagamentos(clienteId),
        listarAcertos(clienteId),
        obterPerfilAtual(true),
        listarClientes(),
      ])
      compras = novasCompras
      pagamentos = novosPagamentos
      acertos = novosAcertos
      perfil = novoPerfil
      clientes = novosClientes
      cliente = clientes.find(item => item.id === clienteId)
      renderPainel()
      renderAbas()
    } catch (e) {
      toast.error(mensagemErro(e, 'Erro ao atualizar lançamentos'))
    }
  }

  function itemLista(opts: {
    id: string
    titulo: string
    data: string
    criado_por?: string | null
    atualizado_por?: string | null
    badgeExtra?: string
    valor: number
    cor: 'rose' | 'emerald'
    permiteRecibo?: boolean
  }): string {
    const corValor =
      opts.cor === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
    const sinal = opts.cor === 'rose' ? '−' : '+'
    const btnRecibo = opts.permiteRecibo
      ? `<button data-recibo="${opts.id}" class="${cls.btnIcone} text-emerald-600 hover:text-emerald-700 dark:text-emerald-400" title="Enviar comprovante/recibo no WhatsApp">🧾</button>`
      : ''

    const autor = extrairPrimeiroNome(opts.criado_por, mapaMembros)
    const editor = opts.atualizado_por ? extrairPrimeiroNome(opts.atualizado_por, mapaMembros) : null
    const textoAutoria = editor
      ? `${formatarData(opts.data)}, Por ${autor} e Edit Por ${editor}`
      : `${formatarData(opts.data)}, Por ${autor}`

    return `
      <li class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-2.5 sm:px-3 sm:py-2.5 transition">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <p class="font-bold text-sm text-slate-900 dark:text-white truncate">${opts.titulo}</p>
            ${opts.badgeExtra ?? ''}
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span class="font-black text-sm ${corValor} whitespace-nowrap">${sinal} ${formatarMoeda(opts.valor)}</span>
            ${btnRecibo}
            <button data-editar="${opts.id}" class="${cls.btnIcone}" title="Editar">✏️</button>
            <button data-excluir="${opts.id}" class="${cls.btnIcone}" title="Excluir">🗑️</button>
          </div>
        </div>
        <div class="mt-1 flex items-center text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
          <span>${textoAutoria}</span>
        </div>
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

  // ---------- Aba: Produtos comprados (saídas) com Autocomplete e Carrinho Rápido ----------
  function renderAbaCompras(): void {
    abaEl.innerHTML = `
      <form id="form-compra" novalidate class="mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
        <div id="container-itens-compra" class="space-y-2"></div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
          <button type="button" id="btn-adicionar-produto" class="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition py-1.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 w-fit">
            <span>➕ Adicionar outro produto</span>
          </button>
          <div class="flex items-center gap-2">
            <label class="${cls.label} whitespace-nowrap mb-0" for="compra-data">Data:</label>
            <input id="compra-data" type="date" class="${cls.input} text-xs py-1.5 w-auto font-semibold" value="${hojeISO()}">
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 pt-1">
          <div id="resumo-carrinho" class="text-xs font-extrabold text-slate-700 dark:text-slate-300">
            Total: <span id="carrinho-total" class="text-rose-600 dark:text-rose-400 font-black text-sm">R$ 0,00</span>
            <span id="carrinho-qtd" class="text-[11px] text-slate-400 font-normal ml-1">(1 item)</span>
          </div>
          <button type="submit" id="btn-submit-compra" class="${cls.btnPrimario} text-xs py-2.5 px-4 font-black">
            Lançar Produto
          </button>
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
            data: c.data,
            criado_por: c.criado_por,
            atualizado_por: c.atualizado_por,
            valor: c.valor,
            cor: 'rose',
          })
        )
        .join('')
    }

    conectarBuscaEOrdenacao(atualizarListaCompras)
    atualizarListaCompras()

    const form = abaEl.querySelector<HTMLFormElement>('#form-compra')!
    const containerItens = abaEl.querySelector<HTMLElement>('#container-itens-compra')!
    const btnAdicionar = abaEl.querySelector<HTMLButtonElement>('#btn-adicionar-produto')!
    const dataInput = abaEl.querySelector<HTMLInputElement>('#compra-data')!
    const carrinhoTotalEl = abaEl.querySelector<HTMLElement>('#carrinho-total')!
    const carrinhoQtdEl = abaEl.querySelector<HTMLElement>('#carrinho-qtd')!
    const btnSubmit = abaEl.querySelector<HTMLButtonElement>('#btn-submit-compra')!

    let contadorLinha = 0

    function atualizarTotaisCarrinho(): void {
      const linhas = containerItens.querySelectorAll<HTMLElement>('.item-compra-linha')
      let total = 0
      linhas.forEach(l => {
        const valInput = l.querySelector<HTMLInputElement>('.input-valor')
        if (valInput && valInput.value) {
          const v = parseValor(valInput.value)
          if (!isNaN(v) && v > 0) total += v
        }
      })

      carrinhoTotalEl.textContent = formatarMoeda(total)
      carrinhoQtdEl.textContent = `(${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'})`
      btnSubmit.textContent = linhas.length === 1 ? 'Lançar Produto' : `Lançar ${linhas.length} Produtos`

      // Oculta botão de remover se houver apenas 1 linha
      linhas.forEach(l => {
        const btnRemover = l.querySelector<HTMLButtonElement>('.btn-remover-linha')
        if (btnRemover) {
          if (linhas.length > 1) {
            btnRemover.classList.remove('invisible')
          } else {
            btnRemover.classList.add('invisible')
          }
        }
      })
    }

    function criarLinhaProduto(): HTMLElement {
      contadorLinha++
      const linhaId = contadorLinha
      const linha = document.createElement('div')
      linha.className = 'item-compra-linha grid grid-cols-2 sm:grid-cols-[2fr_1fr_auto] gap-2 p-2 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 relative'
      linha.dataset.id = String(linhaId)
      linha.innerHTML = `
        <div class="col-span-2 sm:col-span-1 relative">
          <label class="${cls.label} text-[10px] mb-1">Produto / Serviço</label>
          <input type="text" class="input-produto ${cls.input} text-xs py-1.5" placeholder="Ex: Creme hidratante, Design..." autocomplete="off" maxlength="160">
          <div class="box-autocomplete hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-52 overflow-y-auto p-1.5 space-y-1"></div>
        </div>
        <div>
          <label class="${cls.label} text-[10px] mb-1">Valor (R$)</label>
          <input type="text" inputmode="decimal" class="input-valor ${cls.input} text-xs py-1.5" placeholder="0,00" autocomplete="off">
        </div>
        <div class="col-span-2 sm:col-span-1 flex items-end justify-end">
          <button type="button" class="btn-remover-linha ${cls.btnIcone} text-slate-400 hover:text-rose-600" title="Remover item">✕</button>
        </div>
      `

      const prodInput = linha.querySelector<HTMLInputElement>('.input-produto')!
      const valInput = linha.querySelector<HTMLInputElement>('.input-valor')!
      const boxAuto = linha.querySelector<HTMLElement>('.box-autocomplete')!
      const btnRemover = linha.querySelector<HTMLButtonElement>('.btn-remover-linha')!

      async function renderSugestoesLinha(termo: string): Promise<void> {
        try {
          const sugestoes = await obterSugestoesCatalogo(termo)
          if (sugestoes.length === 0) {
            boxAuto.classList.add('hidden')
            boxAuto.innerHTML = ''
            return
          }

          boxAuto.innerHTML = `
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

          boxAuto.classList.remove('hidden')

          boxAuto.querySelectorAll<HTMLButtonElement>('.btn-sugestao').forEach(btn => {
            btn.addEventListener('mousedown', e => {
              e.preventDefault()
              const idx = Number(btn.dataset.idx)
              const item = sugestoes[idx]
              if (item) {
                prodInput.value = item.produto
                valInput.value = valorParaInput(item.valorSugerido)
                boxAuto.classList.add('hidden')
                atualizarTotaisCarrinho()
                const ehMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window)
                if (!ehMobile) {
                  valInput.focus()
                  valInput.select()
                }
              }
            })
          })
        } catch {
          boxAuto.classList.add('hidden')
        }
      }

      prodInput.addEventListener('input', () => {
        renderSugestoesLinha(prodInput.value)
      })

      prodInput.addEventListener('focus', () => {
        renderSugestoesLinha(prodInput.value)
      })

      prodInput.addEventListener('blur', () => {
        setTimeout(() => {
          boxAuto.classList.add('hidden')
        }, 150)
      })

      valInput.addEventListener('input', () => {
        atualizarTotaisCarrinho()
      })

      btnRemover.addEventListener('click', () => {
        linha.remove()
        atualizarTotaisCarrinho()
      })

      return linha
    }

    function reiniciarCarrinho(): void {
      containerItens.innerHTML = ''
      containerItens.appendChild(criarLinhaProduto())
      dataInput.value = hojeISO()
      atualizarTotaisCarrinho()
    }

    reiniciarCarrinho()

    btnAdicionar.addEventListener('click', () => {
      const novaLinha = criarLinhaProduto()
      containerItens.appendChild(novaLinha)
      atualizarTotaisCarrinho()
      const novoInput = novaLinha.querySelector<HTMLInputElement>('.input-produto')
      const ehMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window)
      if (!ehMobile && novoInput) {
        novoInput.focus()
      }
    })

    form.addEventListener('submit', async e => {
      e.preventDefault()
      const linhas = containerItens.querySelectorAll<HTMLElement>('.item-compra-linha')
      const itens: { produto: string; valor: number }[] = []

      for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i]
        const prod = l.querySelector<HTMLInputElement>('.input-produto')!
        const val = l.querySelector<HTMLInputElement>('.input-valor')!
        const nome = prod.value.trim()
        if (!nome) {
          toast.warning(`Informe o nome do produto no item ${i + 1}`)
          prod.focus()
          return
        }
        const valor = validarValor(val.value)
        itens.push({ produto: nome, valor })
      }

      const data = validarData(dataInput.value)
      btnSubmit.disabled = true

      try {
        await Promise.all(
          itens.map(item =>
            criarCompra({
              cliente_id: clienteId,
              produto: item.produto,
              valor: item.valor,
              data,
            })
          )
        )
        toast.success(
          itens.length > 1
            ? `${itens.length} produtos lançados com sucesso!`
            : 'Produto lançado com sucesso!'
        )
        reiniciarCarrinho()
        await recarregarLancamentos()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao lançar produtos'))
      } finally {
        btnSubmit.disabled = false
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
    const { saldoDevedor } = calcularResumo(compras, pagamentos)
    const acertosPendentes = acertos
      .filter(a => a.status === 'pendente')
      .sort((a, b) => a.data.localeCompare(b.data))

    abaEl.innerHTML = `
      <form id="form-pagamento" novalidate class="grid grid-cols-2 sm:grid-cols-[1.2fr_1.3fr_1.1fr_1.8fr_auto] gap-2.5 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
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
        <div>
          <label class="${cls.label}" for="pagamento-descricao">Descrição (opcional)</label>
          <input id="pagamento-descricao" type="text" class="${cls.input}" placeholder="Ex: Parcela 1..." autocomplete="off" maxlength="200">
        </div>
        <div class="col-span-2 sm:col-span-1 flex items-end">
          <button type="submit" class="${cls.btnPrimario} w-full">Lançar</button>
        </div>
        ${
          saldoDevedor > 0 || acertosPendentes.length > 0
            ? `
            <div class="col-span-2 sm:col-span-5 flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
              <span class="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">Atalhos:</span>
              ${
                saldoDevedor > 0
                  ? `<button type="button" id="btn-quitar-total" class="text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition active:scale-95 flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer" title="Preencher com o saldo total">
                      <span>⚡ Quitar Saldo (${formatarMoeda(saldoDevedor)})</span>
                    </button>`
                  : ''
              }
              ${acertosPendentes
                .map(a => {
                  const titulo = a.descricao || 'Acerto'
                  return `
                    <button type="button" data-preencher-acerto-id="${a.id}" data-valor="${a.valor}" data-desc="${escaparHTML(titulo)}" class="btn-atalho-acerto text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30 transition active:scale-95 flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer" title="Preencher com ${escaparHTML(titulo)} (${formatarMoeda(a.valor)}) e excluir do Cronograma ao lançar">
                      <span>🗓️</span>
                      <span>${escaparHTML(titulo)} (${formatarMoeda(a.valor)})</span>
                    </button>
                  `
                })
                .join('')}
            </div>
            `
            : ''
        }
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
            data: p.data,
            criado_por: p.criado_por,
            atualizado_por: p.atualizado_por,
            badgeExtra: badgeForma,
            valor: p.valor,
            cor: 'emerald',
            permiteRecibo: true,
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

    let acertoSelecionadoId: string | null = null

    const botoesAcerto = abaEl.querySelectorAll<HTMLButtonElement>('.btn-atalho-acerto')
    function limparSelecaoAcertos(): void {
      botoesAcerto.forEach(b => b.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-500/30'))
    }

    abaEl.querySelector('#btn-quitar-total')?.addEventListener('click', () => {
      valorInput.value = valorParaInput(saldoDevedor)
      descInput.value = 'Quitação de saldo'
      acertoSelecionadoId = null
      limparSelecaoAcertos()
    })

    botoesAcerto.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.preencherAcertoId
        const val = btn.dataset.valor
        const desc = btn.dataset.desc
        if (id && val) {
          if (acertoSelecionadoId === id) {
            // Se já estava selecionado, desseleciona ao clicar de novo
            acertoSelecionadoId = null
            limparSelecaoAcertos()
            valorInput.value = ''
            descInput.value = ''
            return
          }
          acertoSelecionadoId = id
          valorInput.value = valorParaInput(Number(val))
          descInput.value = desc || ''
          limparSelecaoAcertos()
          btn.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-500/30')
        }
      })
    })

    valorInput.addEventListener('input', () => {
      if (acertoSelecionadoId && valorInput.value.trim() === '') {
        acertoSelecionadoId = null
        limparSelecaoAcertos()
      }
    })

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

        // Identifica se há acerto correspondente para abater/excluir
        let acertoAlvoId = acertoSelecionadoId
        if (!acertoAlvoId) {
          const matchAcerto = acertosPendentes.find(
            a =>
              Math.abs(a.valor - valor) < 0.01 &&
              a.descricao?.trim().toLowerCase() === descInput.value.trim().toLowerCase()
          )
          if (matchAcerto) {
            acertoAlvoId = matchAcerto.id
          }
        }

        if (acertoAlvoId) {
          const acertoAlvo = acertosPendentes.find(a => a.id === acertoAlvoId)
          if (acertoAlvo) {
            if (valor >= acertoAlvo.valor - 0.05) {
              await excluirAcerto(acertoAlvo.id, clienteId)
              const sobra = valor - acertoAlvo.valor
              if (sobra > 0.05) {
                await abaterAcertosComPagamento(clienteId, sobra)
              }
              toast.success(
                `Pagamento lançado e ${descInput.value ? `"${descInput.value}"` : 'parcela'} baixada do Cronograma! 🎉`
              )
            } else {
              // Abatimento parcial da parcela selecionada
              const novoValor = Math.round((acertoAlvo.valor - valor) * 100) / 100
              await atualizarAcerto(acertoAlvo.id, clienteId, { valor: novoValor })
              await reajustarDescricoesParcelas(clienteId)
              toast.success(
                `Pagamento lançado! Parcela abatida de ${formatarMoeda(acertoAlvo.valor)} para ${formatarMoeda(novoValor)} no Cronograma! 🎉`
              )
            }
          }
        } else {
          // Se não vinculou a um acerto específico, abate acertos pendentes em cascata cronológica
          const { acertosQuitados, acertoParcial } = await abaterAcertosComPagamento(clienteId, valor)
          if (acertosQuitados.length > 0 && acertoParcial) {
            toast.success(
              `Pagamento lançado! ${acertosQuitados.length} parcela(s) quitada(s) e próxima reduzida para ${formatarMoeda(acertoParcial.novoValor)}! 🎉`
            )
          } else if (acertosQuitados.length > 0) {
            toast.success(
              `Pagamento lançado e ${acertosQuitados.length} parcela(s) baixada(s) do Cronograma! 🎉`
            )
          } else if (acertoParcial) {
            toast.success(
              `Pagamento lançado! Parcela de ${formatarMoeda(acertoParcial.valorAnterior)} abatida para ${formatarMoeda(acertoParcial.novoValor)} no Cronograma! 🎉`
            )
          } else {
            toast.success('Pagamento lançado com sucesso!')
          }
        }

        // Se o saldo do cliente foi totalmente zerado ou quitado pelo pagamento, limpa eventuais acertos pendentes que sobraram
        if (saldoDevedor - valor <= 0.009) {
          await limparAcertosPendentes(clienteId)
        }

        form.reset()
        acertoSelecionadoId = null
        limparSelecaoAcertos()
        dataInput.value = hojeISO()
        formaSelect.value = 'pix'
        await recarregarLancamentos()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao lançar pagamento'))
      } finally {
        btn.disabled = false
      }
    })

    abaEl.querySelector('#lista-pagamentos')!.addEventListener('click', async e => {
      const btnRecibo = (e.target as HTMLElement).closest<HTMLElement>('[data-recibo]')
      if (btnRecibo) {
        const id = btnRecibo.dataset.recibo!
        const pagamento = pagamentos.find(p => p.id === id)
        if (!pagamento || !cliente) return
        const { saldoDevedor } = calcularResumo(compras, pagamentos)
        const opcoesPix = {
          chavePix: perfil?.chave_pix,
          nomeProfissional: perfil?.beneficiario_pix || perfil?.nome,
        }
        enviarReciboPagamentoWhatsApp(cliente, pagamento, saldoDevedor, opcoesPix)
        return
      }

      const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-editar],[data-excluir]')
      if (!alvo) return
      const id = alvo.dataset.editar ?? alvo.dataset.excluir!
      const pagamento = pagamentos.find(p => p.id === id)
      if (!pagamento) return

      if (alvo.dataset.editar) {
        abrirModalEditarPagamento(pagamento)
        return
      }

      function abrirModalEditarPagamento(pag: Pagamento): void {
        const descLimpa = pag.descricao?.trim() || ''
        let acertoAlvo = descLimpa
          ? acertosPendentes.find(a => a.descricao?.trim().toLowerCase() === descLimpa.toLowerCase())
          : undefined

        if (!acertoAlvo && descLimpa) {
          const infoParcelaPag = parseDescricaoParcela(descLimpa)
          if (infoParcelaPag) {
            acertoAlvo = acertosPendentes.find(a => {
              const infoA = parseDescricaoParcela(a.descricao)
              return infoA && infoA.prefixo.toLowerCase() === infoParcelaPag.prefixo.toLowerCase()
            })
          }
        }

        if (!acertoAlvo && acertosPendentes.length > 0) {
          acertoAlvo = acertosPendentes[0]
        }

        const overlay = criarOverlay(`
          <form id="form-editar-pagamento" class="space-y-4">
            <div class="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-lg shrink-0">
                  ✏️
                </div>
                <div>
                  <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Editar Pagamento
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Altere os dados deste pagamento e sincronize com as parcelas.
                  </p>
                </div>
              </div>
              <button type="button" data-fechar class="${cls.btnIcone} text-lg shrink-0" title="Fechar">✕</button>
            </div>

            <!-- Campos -->
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor pago (R$) *
                </label>
                <input
                  id="input-editar-pag-valor"
                  type="text"
                  inputmode="decimal"
                  value="${valorParaInput(pag.valor)}"
                  required
                  class="${cls.input} text-base sm:text-lg font-black"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Forma de Pagamento
                  </label>
                  <select id="select-editar-pag-forma" class="${cls.input} text-xs">
                    <option value="pix" ${pag.forma_pagamento === 'pix' ? 'selected' : ''}>💠 PIX</option>
                    <option value="dinheiro" ${pag.forma_pagamento === 'dinheiro' ? 'selected' : ''}>💵 Dinheiro</option>
                    <option value="credito" ${pag.forma_pagamento === 'credito' ? 'selected' : ''}>💳 Cartão de Crédito</option>
                    <option value="debito" ${pag.forma_pagamento === 'debito' ? 'selected' : ''}>💳 Cartão de Débito</option>
                    <option value="outro" ${pag.forma_pagamento === 'outro' ? 'selected' : ''}>🏷️ Outro</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    id="input-editar-pag-data"
                    type="date"
                    value="${pag.data}"
                    required
                    class="${cls.input} text-xs"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição (opcional)
                </label>
                <input
                  id="input-editar-pag-desc"
                  type="text"
                  value="${escaparHTML(pag.descricao || '')}"
                  placeholder="Ex: Parcela 1/2, Quitação parcial..."
                  class="${cls.input} text-xs"
                />
              </div>
            </div>

            <!-- Caixa Dinâmica de Sincronização no Cronograma (Opção A + C) -->
            <div id="box-sincronizar-edicao" class="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5">
              <label class="flex items-start gap-2.5 cursor-pointer select-none">
                <input id="chk-sincronizar-edicao" type="checkbox" checked class="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                <div class="min-w-0">
                  <span class="text-xs font-black text-slate-900 dark:text-white block">
                    Sincronizar alteração no Cronograma de Acertos (Recomendado)
                  </span>
                  <p id="texto-explicativo-edicao" class="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5">
                    Se o valor mudar, a diferença será recalculada automaticamente na parcela correspondente.
                  </p>
                </div>
              </label>
            </div>

            <!-- Ações -->
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button type="button" data-fechar class="${cls.btnSecundario} text-xs py-2 px-3">
                Cancelar
              </button>
              <button id="btn-salvar-edicao-pagamento" type="submit" class="${cls.btnPrimario} text-xs py-2 px-4 flex items-center gap-1.5">
                <span>💾</span>
                <span>Salvar Alterações</span>
              </button>
            </div>
          </form>
        `)

        const fechar = (): void => overlay.remove()
        overlay.querySelectorAll('[data-fechar]').forEach(btn => btn.addEventListener('click', fechar))

        overlay.addEventListener('click', e => {
          if (e.target === overlay) fechar()
        })

        const onKeyDown = (e: KeyboardEvent): void => {
          if (e.key === 'Escape') {
            fechar()
            document.removeEventListener('keydown', onKeyDown)
          }
        }
        document.addEventListener('keydown', onKeyDown)

        const form = overlay.querySelector<HTMLFormElement>('#form-editar-pagamento')!
        const valorInput = overlay.querySelector<HTMLInputElement>('#input-editar-pag-valor')!
        const formaSelect = overlay.querySelector<HTMLSelectElement>('#select-editar-pag-forma')!
        const dataInput = overlay.querySelector<HTMLInputElement>('#input-editar-pag-data')!
        const descInput = overlay.querySelector<HTMLInputElement>('#input-editar-pag-desc')!
        const chkSincronizar = overlay.querySelector<HTMLInputElement>('#chk-sincronizar-edicao')!
        const textoExplicativoEl = overlay.querySelector<HTMLElement>('#texto-explicativo-edicao')!
        const btnSalvar = overlay.querySelector<HTMLButtonElement>('#btn-salvar-edicao-pagamento')!

        function atualizarTextoExplicativo(): void {
          try {
            const novoVal = validarValor(valorInput.value)
            const dif = Math.round((novoVal - pag.valor) * 100) / 100
            if (Math.abs(dif) < 0.01) {
              textoExplicativoEl.innerHTML = `O valor de <strong>${formatarMoeda(pag.valor)}</strong> não foi alterado. Nenhuma mudança no Cronograma.`
            } else if (dif < 0) {
              const valorDevolver = Math.abs(dif)
              if (acertoAlvo) {
                textoExplicativoEl.innerHTML = `O pagamento diminuiu <strong>${formatarMoeda(valorDevolver)}</strong>. Esse valor será somado de volta no acerto <strong>"${escaparHTML(acertoAlvo.descricao || 'Acerto')}"</strong> (passará de ${formatarMoeda(acertoAlvo.valor)} para <strong>${formatarMoeda(acertoAlvo.valor + valorDevolver)}</strong>).`
              } else {
                textoExplicativoEl.innerHTML = `O pagamento diminuiu <strong>${formatarMoeda(valorDevolver)}</strong>. Esse valor será recriado no Cronograma para cobrir o saldo reaberto.`
              }
            } else {
              const valorAbater = dif
              if (acertoAlvo) {
                const novoValAcerto = Math.max(0, Math.round((acertoAlvo.valor - valorAbater) * 100) / 100)
                textoExplicativoEl.innerHTML = `O pagamento aumentou <strong>${formatarMoeda(valorAbater)}</strong>. Esse valor extra abaterá o acerto <strong>"${escaparHTML(acertoAlvo.descricao || 'Acerto')}"</strong> (passará de ${formatarMoeda(acertoAlvo.valor)} para <strong>${formatarMoeda(novoValAcerto)}</strong>).`
              } else {
                textoExplicativoEl.innerHTML = `O pagamento aumentou <strong>${formatarMoeda(valorAbater)}</strong>. Esse valor extra abaterá automaticamente os acertos pendentes.`
              }
            }
          } catch {
            textoExplicativoEl.textContent = 'Digite um valor válido para calcular a sincronização.'
          }
        }

        valorInput.addEventListener('input', atualizarTextoExplicativo)
        atualizarTextoExplicativo()

        form.addEventListener('submit', async ev => {
          ev.preventDefault()
          btnSalvar.disabled = true
          btnSalvar.textContent = 'Salvando...'
          try {
            const novoValor = validarValor(valorInput.value)
            const novaData = validarData(dataInput.value)
            const novaForma = formaSelect.value
            const novaDesc = descInput.value.trim()
            const deveSincronizar = chkSincronizar.checked
            const dif = Math.round((novoValor - pag.valor) * 100) / 100

            // 1. Atualiza o registro do pagamento
            await atualizarPagamento(pag.id, {
              valor: novoValor,
              data: novaData,
              descricao: novaDesc,
              forma_pagamento: novaForma,
            })

            // 2. Se a opção estiver marcada e o valor foi alterado, sincroniza com o Cronograma
            if (deveSincronizar && Math.abs(dif) >= 0.01) {
              if (dif < 0) {
                // Pagamento diminuiu: devolve a diferença para a parcela/acerto
                const valorRestaurar = Math.abs(dif)
                const res = await restaurarAcertoDePagamentoExcluido(
                  clienteId,
                  { valor: valorRestaurar, data: novaData, descricao: novaDesc },
                  acertoAlvo?.id
                )
                if (res.acertoAtualizado) {
                  toast.success(
                    `Pagamento atualizado e ${formatarMoeda(valorRestaurar)} somado de volta na parcela (total: ${formatarMoeda(res.acertoAtualizado.valor)})! 🎉`
                  )
                } else if (res.acertoCriado) {
                  toast.success(
                    `Pagamento atualizado e parcela de ${formatarMoeda(res.acertoCriado.valor)} recriada no Cronograma! 🎉`
                  )
                }
              } else {
                // Pagamento aumentou: abate a diferença extra das parcelas
                const valorExtra = dif
                if (acertoAlvo) {
                  if (valorExtra >= acertoAlvo.valor - 0.05) {
                    await excluirAcerto(acertoAlvo.id, clienteId)
                    const sobra = valorExtra - acertoAlvo.valor
                    if (sobra > 0.05) {
                      await abaterAcertosComPagamento(clienteId, sobra)
                    }
                    toast.success(
                      `Pagamento atualizado e ${acertoAlvo.descricao ? `"${acertoAlvo.descricao}"` : 'parcela'} quitada no Cronograma! 🎉`
                    )
                  } else {
                    const novoValAcerto = Math.round((acertoAlvo.valor - valorExtra) * 100) / 100
                    await atualizarAcerto(acertoAlvo.id, clienteId, { valor: novoValAcerto })
                    await reajustarDescricoesParcelas(clienteId)
                    toast.success(
                      `Pagamento atualizado e parcela abatida para ${formatarMoeda(novoValAcerto)}! 🎉`
                    )
                  }
                } else {
                  await abaterAcertosComPagamento(clienteId, valorExtra)
                  toast.success('Pagamento atualizado e Cronograma sincronizado com sucesso!')
                }
              }
            } else {
              toast.success('Pagamento atualizado com sucesso!')
            }

            // Se o saldo total do cliente foi zerado com essa edição, limpa eventuais acertos pendentes
            if (saldoDevedor - dif <= 0.009) {
              await limparAcertosPendentes(clienteId)
            }

            fechar()
            await recarregarLancamentos()
          } catch (err) {
            toast.error(mensagemErro(err, 'Erro ao atualizar pagamento'))
            btnSalvar.disabled = false
            btnSalvar.textContent = 'Salvar Alterações'
          }
        })
      }

      function abrirModalExcluirPagamento(pag: Pagamento): void {
        const formaInfo = obterInfoFormaPagamento(pag.forma_pagamento)

        // Localiza a parcela/acerto existente para onde o valor deve retornar
        const descLimpa = pag.descricao?.trim() || ''
        let acertoAlvo = descLimpa
          ? acertosPendentes.find(a => a.descricao?.trim().toLowerCase() === descLimpa.toLowerCase())
          : undefined

        if (!acertoAlvo && descLimpa) {
          const infoParcelaPag = parseDescricaoParcela(descLimpa)
          if (infoParcelaPag) {
            acertoAlvo = acertosPendentes.find(a => {
              const infoA = parseDescricaoParcela(a.descricao)
              return infoA && infoA.prefixo.toLowerCase() === infoParcelaPag.prefixo.toLowerCase()
            })
          }
        }

        // Se ainda não achou, mas há acertos pendentes, devolve para a parcela pendente existente
        if (!acertoAlvo && acertosPendentes.length > 0) {
          acertoAlvo = acertosPendentes[0]
        }

        const tituloOpcao = acertoAlvo
          ? 'Devolver valor para a parcela existente (Recomendado)'
          : 'Recriar parcela no Cronograma (Recomendado)'

        const textoExplicativo = acertoAlvo
          ? `Soma <strong>${formatarMoeda(pag.valor)}</strong> de volta no acerto <strong>"${escaparHTML(acertoAlvo.descricao || 'Acerto combinado')}"</strong>, que passará de <strong>${formatarMoeda(acertoAlvo.valor)}</strong> para <strong>${formatarMoeda(acertoAlvo.valor + pag.valor)}</strong>.`
          : `Recria a parcela de <strong>${formatarMoeda(pag.valor)}</strong> no Cronograma para cobrir o saldo devedor que voltará a ficar em aberto.`

        const overlay = criarOverlay(`
          <div class="space-y-4">
            <div class="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-lg shrink-0">
                  🗑️
                </div>
                <div>
                  <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Excluir Pagamento
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Confirme a exclusão do registro deste pagamento.
                  </p>
                </div>
              </div>
              <button type="button" data-fechar class="${cls.btnIcone} text-lg shrink-0" title="Fechar">✕</button>
            </div>

            <!-- Dados do Pagamento -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500 dark:text-slate-400">Valor do Pagamento</span>
                <span class="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">${formatarMoeda(pag.valor)}</span>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Data</span>
                <span class="font-bold">${formatarData(pag.data)}</span>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Forma</span>
                <span class="font-bold">${formaInfo.icone} ${formaInfo.label}</span>
              </div>
              ${
                pag.descricao && pag.descricao.trim()
                  ? `<div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-white/10">
                       <span>Descrição</span>
                       <span class="font-bold text-right truncate max-w-[60%]">${escaparHTML(pag.descricao.trim())}</span>
                     </div>`
                  : ''
              }
            </div>

            <!-- Opção de Restauração no Cronograma (Opção A + C) -->
            <div class="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5">
              <label class="flex items-start gap-2.5 cursor-pointer select-none">
                <input id="chk-restaurar-acerto" type="checkbox" checked class="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                <div class="min-w-0">
                  <span class="text-xs font-black text-slate-900 dark:text-white block">
                    ${tituloOpcao}
                  </span>
                  <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5">
                    ${textoExplicativo}
                  </p>
                </div>
              </label>
            </div>

            <!-- Ações -->
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button type="button" data-fechar class="${cls.btnSecundario} text-xs py-2 px-3">
                Cancelar
              </button>
              <button id="btn-confirmar-excluir-pagamento" type="button" class="inline-flex items-center justify-center gap-1.5 text-xs font-black py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-sm transition cursor-pointer">
                <span>🗑️</span>
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        `)

        const fechar = (): void => overlay.remove()
        overlay.querySelectorAll('[data-fechar]').forEach(btn => btn.addEventListener('click', fechar))

        overlay.addEventListener('click', e => {
          if (e.target === overlay) fechar()
        })

        const onKeyDown = (e: KeyboardEvent): void => {
          if (e.key === 'Escape') {
            fechar()
            document.removeEventListener('keydown', onKeyDown)
          }
        }
        document.addEventListener('keydown', onKeyDown)

        const btnConfirmar = overlay.querySelector<HTMLButtonElement>('#btn-confirmar-excluir-pagamento')!
        const chkRestaurar = overlay.querySelector<HTMLInputElement>('#chk-restaurar-acerto')!

        btnConfirmar.addEventListener('click', async () => {
          btnConfirmar.disabled = true
          btnConfirmar.textContent = 'Excluindo...'
          try {
            const deveRestaurar = chkRestaurar.checked

            // 1. Exclui o pagamento
            await excluirPagamento(pag.id)

            // 2. Se a opção estiver marcada, restaura ou recria a parcela no Cronograma
            if (deveRestaurar) {
              const res = await restaurarAcertoDePagamentoExcluido(clienteId, pag, acertoAlvo?.id)
              if (res.acertoAtualizado) {
                toast.success(
                  `Pagamento excluído e parcela restaurada para ${formatarMoeda(res.acertoAtualizado.valor)} no Cronograma! 🎉`
                )
              } else if (res.acertoCriado) {
                toast.success(
                  `Pagamento excluído e parcela de ${formatarMoeda(res.acertoCriado.valor)} recriada no Cronograma! 🎉`
                )
              } else {
                toast.success('Pagamento excluído com sucesso!')
              }
            } else {
              toast.success('Pagamento excluído com sucesso (sem alterações no Cronograma).')
            }

            fechar()
            await recarregarLancamentos()
          } catch (err) {
            toast.error(mensagemErro(err, 'Erro ao excluir pagamento'))
            btnConfirmar.disabled = false
            btnConfirmar.textContent = 'Confirmar Exclusão'
          }
        })
      }

      abrirModalExcluirPagamento(pagamento)
    })
  }

  renderSeletor()
  renderPainel()
  renderAbas()
}
