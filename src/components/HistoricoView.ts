import { listarHistorico } from '@/services/historico'
import type { HistoricoItem } from '@/types'
import { escaparHTML, formatarDataHora, formatarMoeda } from '@/utils/format'
import { mensagemErro } from '@/utils/toast'
import { cls, erroHTML, loadingHTML } from '@/utils/ui'

function descreverRegistro(item: HistoricoItem): string {
  const dados = item.dados_depois || item.dados_antes || {}
  const nomeCliente = item.cliente_nome

  if (item.tabela === 'clientes') {
    const nome = String(dados.nome || nomeCliente || 'Cliente sem nome')
    const tel = dados.telefone ? ` (${dados.telefone})` : ''
    if (item.acao === 'criou') {
      return `Cadastrou o(a) cliente <strong>${escaparHTML(nome)}</strong>${escaparHTML(tel)}`
    }
    if (item.acao === 'excluiu') {
      return `Excluiu o(a) cliente <strong>${escaparHTML(nome)}</strong>${escaparHTML(tel)} e todo o seu histórico`
    }
    return `Editou dados cadastrais do(a) cliente <strong>${escaparHTML(nome)}</strong>${escaparHTML(tel)}`
  }

  if (item.tabela === 'compras') {
    const prod = String(dados.produto || 'Produto')
    const val = Number(dados.valor) || 0
    const alvoCliente = nomeCliente
      ? ` para o(a) cliente <strong>${escaparHTML(nomeCliente)}</strong>`
      : ''

    if (item.acao === 'criou') {
      return `Lançou o produto <strong>${escaparHTML(prod)}</strong> no valor de <strong>${formatarMoeda(val)}</strong>${alvoCliente}`
    }
    if (item.acao === 'excluiu') {
      return `Excluiu o produto <strong>${escaparHTML(prod)}</strong> no valor de <strong>${formatarMoeda(val)}</strong>${alvoCliente}`
    }
    return `Editou o produto <strong>${escaparHTML(prod)}</strong> no valor de <strong>${formatarMoeda(val)}</strong>${alvoCliente}`
  }

  if (item.tabela === 'pagamentos') {
    const val = Number(dados.valor) || 0
    const desc = dados.descricao ? ` ("${escaparHTML(String(dados.descricao))}")` : ''
    const alvoCliente = nomeCliente
      ? ` do(a) cliente <strong>${escaparHTML(nomeCliente)}</strong>`
      : ''

    if (item.acao === 'criou') {
      return `Registrou pagamento de <strong>${formatarMoeda(val)}</strong>${desc}${alvoCliente}`
    }
    if (item.acao === 'excluiu') {
      return `Excluiu pagamento de <strong>${formatarMoeda(val)}</strong>${desc}${alvoCliente}`
    }
    return `Editou pagamento de <strong>${formatarMoeda(val)}</strong>${desc}${alvoCliente}`
  }

  if (item.tabela === 'autorizados') {
    const nome = String(dados.nome || dados.email || 'Membro')
    const papel = dados.papel ? ` (${dados.papel})` : ''
    if (item.acao === 'criou') {
      return `Autorizou o membro <strong>${escaparHTML(nome)}</strong>${papel} na equipe`
    }
    if (item.acao === 'excluiu') {
      return `Removeu o membro <strong>${escaparHTML(nome)}</strong>${papel} da equipe`
    }
    return `Editou dados do membro <strong>${escaparHTML(nome)}</strong>${papel}`
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
    if (['atualizado_por', 'atualizado_em', 'created_at', 'id', 'cliente_id'].includes(k)) continue
    const vAntes = antes[k]
    const vDepois = depois[k]
    if (JSON.stringify(vAntes) !== JSON.stringify(vDepois)) {
      mudancas.push(
        `<span class="text-slate-500 font-bold">${escaparHTML(k)}:</span> <del class="text-rose-500">${escaparHTML(String(vAntes ?? ''))}</del> ➔ <ins class="text-emerald-500 no-underline font-bold">${escaparHTML(String(vDepois ?? ''))}</ins>`
      )
    }
  }

  if (mudancas.length === 0) return ''

  return `
    <div class="mt-2.5 p-2.5 bg-slate-100 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono space-y-1 border border-slate-200/60 dark:border-slate-800">
      ${mudancas.map(m => `<div>${m}</div>`).join('')}
    </div>
  `
}

function badgeAcao(acao: string): string {
  if (acao === 'criou') {
    return `<span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">Criou</span>`
  }
  if (acao === 'editou') {
    return `<span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 shrink-0">Editou</span>`
  }
  return `<span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shrink-0">Excluiu</span>`
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
  let termoBusca = ''

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">
      <section class="${cls.card} p-4 sm:p-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="font-black text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span>📜</span>
              <span>Histórico de Alterações</span>
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rastreamento completo informando quem realizou a ação e para qual cliente foi feita.
            </p>
          </div>
        </div>

        <!-- Filtros e Busca Rápida -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              id="busca-historico"
              type="text"
              placeholder="Buscar por cliente, produto ou membro..."
              class="${cls.input} text-xs font-bold pl-8 py-2 w-full"
            />
          </div>
          <div class="shrink-0">
            <select id="filtro-tabela" class="${cls.input} text-xs font-bold py-2 w-full sm:w-auto">
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
  const buscaInput = container.querySelector<HTMLInputElement>('#busca-historico')!

  function renderLista(): void {
    const termo = termoBusca.trim().toLowerCase()

    const filtrados = historico.filter(item => {
      // Filtro de tabela
      if (filtroTabela !== 'todas' && item.tabela !== filtroTabela) {
        return false
      }

      // Filtro de texto (busca)
      if (termo) {
        const dados = item.dados_depois || item.dados_antes || {}
        const textoCompleto = [
          item.cliente_nome || '',
          item.usuario_nome || '',
          item.usuario_email || '',
          dados.nome ? String(dados.nome) : '',
          dados.produto ? String(dados.produto) : '',
          dados.descricao ? String(dados.descricao) : '',
          dados.valor ? String(dados.valor) : '',
        ]
          .join(' ')
          .toLowerCase()

        if (!textoCompleto.includes(termo)) {
          return false
        }
      }

      return true
    })

    if (filtrados.length === 0) {
      listaEl.innerHTML = `
        <li class="text-center py-10 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Nenhuma alteração encontrada com os filtros selecionados.
        </li>
      `
      return
    }

    listaEl.innerHTML = filtrados
      .map(item => {
        const usuario = item.usuario_nome
          ? `<span class="font-bold text-slate-900 dark:text-white">${escaparHTML(item.usuario_nome)}</span> <span class="text-slate-400 text-[11px] font-normal">(${escaparHTML(item.usuario_email)})</span>`
          : `<span class="font-bold text-slate-900 dark:text-white">${escaparHTML(item.usuario_email)}</span>`

        // Tag visual identificando o cliente envolvido
        let tagCliente = ''
        if (item.cliente_nome) {
          if (item.tabela === 'clientes' && item.acao === 'excluiu') {
            tagCliente = `
              <span class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg shrink-0" title="Cliente excluído">
                <span>🚨 Cliente:</span>
                <span class="truncate max-w-[140px] sm:max-w-[200px]">${escaparHTML(item.cliente_nome)}</span>
              </span>
            `
          } else if (item.cliente_id) {
            tagCliente = `
              <a href="#/cliente/${item.cliente_id}"
                 class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-2 py-0.5 rounded-lg transition shrink-0"
                 title="Ir para a ficha de ${escaparHTML(item.cliente_nome)}">
                <span>👤 Cliente:</span>
                <span class="truncate max-w-[140px] sm:max-w-[200px] underline decoration-emerald-500/40">${escaparHTML(item.cliente_nome)}</span>
              </a>
            `
          } else {
            tagCliente = `
              <span class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700/80 px-2 py-0.5 rounded-lg shrink-0">
                <span>👤 Cliente:</span>
                <span class="truncate max-w-[140px] sm:max-w-[200px]">${escaparHTML(item.cliente_nome)}</span>
              </span>
            `
          }
        }

        return `
          <li class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-4 text-xs transition hover:border-slate-300 dark:hover:border-slate-600">
            <!-- Barra Superior: Ação + Autor + Cliente + Horário -->
            <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div class="flex items-center gap-2 flex-wrap min-w-0">
                ${badgeAcao(item.acao)}
                ${usuario}
                ${tagCliente}
              </div>
              <span class="text-[11px] text-slate-400 font-medium shrink-0">🕒 ${formatarDataHora(item.created_at)}</span>
            </div>

            <!-- Descrição detalhada da alteração informando o cliente -->
            <div class="text-slate-800 dark:text-slate-200 text-xs sm:text-[13px] leading-relaxed mt-1">
              ${descreverRegistro(item)}
            </div>

            <!-- Diffs de antes/depois quando for edição -->
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

  buscaInput.addEventListener('input', () => {
    termoBusca = buscaInput.value
    renderLista()
  })

  renderLista()
}
