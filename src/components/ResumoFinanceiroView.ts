import { obterResumoFinanceiro } from '@/services/financeiro'
import { listarClientesComSaldo } from '@/services/clientes'
import { exportarBackupCompleto } from '@/services/backup'
import type { ResumoFinanceiro } from '@/types'
import { formatarMesAno, formatarMoeda, escaparHTML } from '@/utils/format'
import { toast, mensagemErro } from '@/utils/toast'
import { erroHTML, loadingHTML } from '@/utils/ui'

/**
 * Aba exclusiva: Resumo Financeiro com controle de período, balanço de entradas e saídas,
 * detalhamento por forma de pagamento e exportação de relatórios/backup.
 */
export async function renderResumoFinanceiro(container: HTMLElement): Promise<void> {
  container.innerHTML = loadingHTML()

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

  let totalAReceberGeral = 0
  let totalDevedoresGeral = 0
  let totalDevedoresAntigosGeral = 0

  async function carregarDados(): Promise<void> {
    try {
      const [resumo, clientes] = await Promise.all([
        obterResumoFinanceiro(
          periodoTipo === 'tudo' ? { tudo: true } : { ano: periodoAno, mes: periodoMes }
        ),
        listarClientesComSaldo(),
      ])
      resumoFin = resumo
      totalAReceberGeral = clientes.reduce(
        (acc, c) => acc + (c.saldo_devedor > 0 ? c.saldo_devedor : 0),
        0
      )
      totalDevedoresGeral = clientes.filter(c => c.saldo_devedor > 0).length
      totalDevedoresAntigosGeral = clientes.filter(
        c => c.saldo_devedor > 0 && (c.dias_atraso || 0) >= 30
      ).length
    } catch (err) {
      console.warn('Erro ao carregar dados financeiros:', err)
      toast.error(mensagemErro(err, 'Erro ao carregar resumo financeiro'))
    }
  }

  try {
    await carregarDados()
  } catch (err) {
    container.innerHTML = erroHTML(escaparHTML(mensagemErro(err, 'Erro ao carregar tela financeira')))
    return
  }

  function desenhar(): void {
    const rotuloPeriodo =
      periodoTipo === 'tudo' ? 'Todo o Período' : formatarMesAno(periodoAno, periodoMes)

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

    container.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-4">
        <!-- Título e Ação de Backup -->
        <div class="flex items-center justify-between gap-2 px-1">
          <div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>📊</span>
              <span>Resumo Financeiro</span>
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento de entradas, vendas e saldo a receber.
            </p>
          </div>
          <button id="btn-exportar-backup" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition active:scale-95 shadow-xs cursor-pointer shrink-0" title="Baixar relatório completo em planilha Excel / CSV">
            <span>📥</span>
            <span class="hidden sm:inline">Exportar Planilha</span>
            <span class="sm:hidden">Planilha</span>
          </button>
        </div>

        <!-- Seletor de Período -->
        <section class="bg-white/95 text-slate-900 border border-slate-200/90 shadow-md dark:bg-slate-900 dark:text-white dark:border-slate-800 p-4 sm:p-5 rounded-3xl space-y-3.5">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-white/10">
            <div class="flex items-center justify-between sm:justify-start gap-2">
              <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-widest">
                Período Selecionado
              </span>
              <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/10 rounded-xl px-1.5 py-0.5">
                <button id="btn-mes-anterior" type="button" class="px-2 py-0.5 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-emerald-500 rounded-lg transition active:scale-95" title="Mês anterior">◀</button>
                <span id="rotulo-mes-ano" class="text-xs font-black text-slate-900 dark:text-white px-1 whitespace-nowrap">${escaparHTML(rotuloPeriodo)}</span>
                <button id="btn-mes-proximo" type="button" class="px-2 py-0.5 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-emerald-500 rounded-lg transition active:scale-95" title="Próximo mês">▶</button>
              </div>
            </div>

            <div class="flex items-center gap-1 text-[11px] font-bold" role="group">
              <button id="btn-periodo-atual" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition active:scale-95 ${
                ehMesAtual
                  ? 'bg-emerald-600 text-white font-black shadow-sm'
                  : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }">Este Mês</button>
              <button id="btn-periodo-anterior" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition active:scale-95 ${
                ehMesAnterior
                  ? 'bg-emerald-600 text-white font-black shadow-sm'
                  : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }">Mês Anterior</button>
              <button id="btn-periodo-tudo" type="button" class="flex-1 sm:flex-none px-2.5 py-1 rounded-xl transition active:scale-95 ${
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
              <span class="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate block">${formatarMoeda(totalAReceberGeral)}</span>
              <span class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block truncate">
                ${totalDevedoresGeral} devedores${totalDevedoresAntigosGeral > 0 ? ` • <strong class="text-amber-600 dark:text-amber-400">${totalDevedoresAntigosGeral} (+30d)</strong>` : ''}
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
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
              <div class="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2 col-span-2 sm:col-span-1">
                <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">🏷️ Outro</span>
                <span class="text-xs sm:text-sm font-black text-slate-600 dark:text-slate-300 block truncate">${formatarMoeda(resumoFin.porFormaPagamento.outro || 0)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    `

    // Eventos de navegação de período
    container.querySelector('#btn-mes-anterior')?.addEventListener('click', async () => {
      periodoTipo = 'mes'
      if (periodoMes === 1) {
        periodoMes = 12
        periodoAno--
      } else {
        periodoMes--
      }
      await carregarDados()
      desenhar()
    })

    container.querySelector('#btn-mes-proximo')?.addEventListener('click', async () => {
      periodoTipo = 'mes'
      if (periodoMes === 12) {
        periodoMes = 1
        periodoAno++
      } else {
        periodoMes++
      }
      await carregarDados()
      desenhar()
    })

    container.querySelector('#btn-periodo-atual')?.addEventListener('click', async () => {
      periodoTipo = 'mes'
      periodoAno = dataHoje.getFullYear()
      periodoMes = dataHoje.getMonth() + 1
      await carregarDados()
      desenhar()
    })

    container.querySelector('#btn-periodo-anterior')?.addEventListener('click', async () => {
      periodoTipo = 'mes'
      const ant = new Date(dataHoje.getFullYear(), dataHoje.getMonth() - 1, 1)
      periodoAno = ant.getFullYear()
      periodoMes = ant.getMonth() + 1
      await carregarDados()
      desenhar()
    })

    container.querySelector('#btn-periodo-tudo')?.addEventListener('click', async () => {
      periodoTipo = 'tudo'
      await carregarDados()
      desenhar()
    })

    // Exportar Backup / Planilha
    const btnExportar = container.querySelector<HTMLButtonElement>('#btn-exportar-backup')
    btnExportar?.addEventListener('click', async () => {
      const textoOriginal = btnExportar.innerHTML
      btnExportar.disabled = true
      btnExportar.innerHTML = '<span>⏳ Exportando...</span>'
      try {
        await exportarBackupCompleto()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao exportar planilha'))
      } finally {
        btnExportar.disabled = false
        btnExportar.innerHTML = textoOriginal
      }
    })
  }

  desenhar()
}
