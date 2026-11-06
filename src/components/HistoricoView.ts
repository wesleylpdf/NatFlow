import { listarHistorico } from '@/services/historico'
import type { HistoricoItem } from '@/types'
import { escaparHTML, formatarDataHora, formatarMoeda } from '@/utils/format'
import { mensagemErro } from '@/utils/toast'
import { cls, erroHTML, loadingHTML } from '@/utils/ui'

function descreverRegistro(item: HistoricoItem): string {
  const dados = item.dados_depois || item.dados_antes || {}

  if (item.tabela === 'clientes') {
    const nome = String(dados.nome || 'Cliente sem nome')
    const tel = dados.telefone ? ` (${dados.telefone})` : ''
    return `Cliente <strong>${escaparHTML(nome)}</strong>${escaparHTML(tel)}`
  }

  if (item.tabela === 'compras') {
    const prod = String(dados.produto || 'Produto')
    const val = Number(dados.valor) || 0
    return `Produto <strong>${escaparHTML(prod)}</strong> no valor de <strong>${formatarMoeda(val)}</strong>`
  }

  if (item.tabela === 'pagamentos') {
    const val = Number(dados.valor) || 0
    const desc = dados.descricao ? ` - "${escaparHTML(String(dados.descricao))}"` : ''
    return `Pagamento de <strong>${formatarMoeda(val)}</strong>${desc}`
  }

  if (item.tabela === 'autorizados') {
    const nome = String(dados.nome || dados.email || 'Membro')
    const papel = dados.papel ? ` (${dados.papel})` : ''
    return `Membro da equipe <strong>${escaparHTML(nome)}</strong>${papel}`
  }

  return `Registro em ${item.tabela}`
}

function detalharAlteracao(item: HistoricoItem): string {
  if (item.acao !== 'editou' || !item.dados_antes || !item.dados_depois) {
    return ''
  }

  const antes = item.dados_antes
  const depois = item.dados_depois
  const mudancas: string[] = []

  const chaves = Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)]))
  for (const k of chaves) {
    if (['atualizado_por', 'atualizado_em', 'created_at', 'id'].includes(k)) continue
    const vAntes = antes[k]
    const vDepois = depois[k]
    if (JSON.stringify(vAntes) !== JSON.stringify(vDepois)) {
      mudancas.push(
        `<span class="text-slate-500">${k}:</span> <del class="text-rose-500">${escaparHTML(String(vAntes ?? ''))}</del> ➔ <ins class="text-emerald-500 no-underline font-bold">${escaparHTML(String(vDepois ?? ''))}</ins>`
      )
    }
  }

  if (mudancas.length === 0) return ''

  return `
    <div class="mt-2 p-2 bg-slate-100 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono space-y-1">
      ${mudancas.map(m => `<div>${m}</div>`).join('')}
    </div>
  `
}

function badgeAcao(acao: string): string {
  if (acao === 'criou') {
    return `<span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">Criou</span>`
  }
  if (acao === 'editou') {
    return `<span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">Editou</span>`
  }
  return `<span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">Excluiu</span>`
}

export async function renderHistorico(container: HTMLElement, clienteId?: string): Promise<void> {
  container.innerHTML = loadingHTML()

  let historico: HistoricoItem[]
  try {
    historico = await listarHistorico(clienteId)
  } catch (e) {
    container.innerHTML = erroHTML(escaparHTML(mensagemErro(e, 'Erro ao carregar histórico')))
    return
  }

  let filtroTabela = 'todas'

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-5">
      <section class="${cls.card} p-4 sm:p-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="font-black text-base text-slate-900 dark:text-white">📜 Histórico de Alterações</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rastreamento imutável de quem criou, editou ou excluiu cada dado no NatFlow.
            </p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <select id="filtro-tabela" class="${cls.input} text-xs font-bold py-1.5">
              <option value="todas">Todos os registros</option>
              <option value="clientes">Apenas Clientes</option>
              <option value="compras">Apenas Produtos</option>
              <option value="pagamentos">Apenas Pagamentos</option>
              <option value="autorizados">Equipe / Acessos</option>
            </select>
          </div>
        </div>

        <ul id="lista-historico" class="space-y-2.5"></ul>
      </section>
    </div>
  `

  const listaEl = container.querySelector<HTMLElement>('#lista-historico')!
  const filtroSelect = container.querySelector<HTMLSelectElement>('#filtro-tabela')!

  function renderLista(): void {
    const filtrados = historico.filter(item => {
      if (filtroTabela === 'todas') return true
      return item.tabela === filtroTabela
    })

    if (filtrados.length === 0) {
      listaEl.innerHTML = `<li class="text-center py-8 text-sm text-slate-500 dark:text-slate-400">Nenhum registro de alteração encontrado.</li>`
      return
    }

    listaEl.innerHTML = filtrados
      .map(item => {
        const usuario = item.usuario_nome
          ? `${escaparHTML(item.usuario_nome)} <span class="text-slate-400 text-xs font-normal">(${escaparHTML(item.usuario_email)})</span>`
          : escaparHTML(item.usuario_email)

        return `
          <li class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-4 text-xs">
            <div class="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <div class="flex items-center gap-2">
                ${badgeAcao(item.acao)}
                <span class="font-bold text-slate-800 dark:text-slate-200">${usuario}</span>
              </div>
              <span class="text-[11px] text-slate-400 font-medium">🕒 ${formatarDataHora(item.created_at)}</span>
            </div>

            <div class="text-slate-700 dark:text-slate-300 text-xs sm:text-[13px] mt-1">
              ${descreverRegistro(item)}
            </div>

            ${detalharAlteracao(item)}
          </li>
        `
      })
      .join('')
  }

  filtroSelect.addEventListener('change', () => {
    filtroTabela = filtroSelect.value
    renderLista()
  })

  renderLista()
}
