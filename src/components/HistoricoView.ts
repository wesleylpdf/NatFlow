import { listarHistorico } from '@/services/historico'
import type { HistoricoItem } from '@/types'
import { escaparHTML, formatarDataHora, formatarMoeda } from '@/utils/format'
import { toast, mensagemErro } from '@/utils/toast'
import { cls, erroHTML, loadingHTML } from '@/utils/ui'

/**
 * Renderiza o botão interativo com tag visual do cliente para ser inserido inline nas frases
 */
function renderBotaoClienteInline(item: HistoricoItem): string {
  const nome = item.cliente_nome
  if (!nome) return ''

  if (item.tabela === 'clientes' && item.acao === 'excluiu') {
    return `<span class="inline-flex items-center gap-1 font-black text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded-lg text-xs align-middle my-0.5" title="Cliente excluído">
      <span>🚨</span>
      <span>${escaparHTML(nome)}</span>
    </span>`
  }

  if (item.cliente_id) {
    return `<a href="#/cliente/${item.cliente_id}"
      class="inline-flex items-center gap-1 font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-xs align-middle my-0.5 transition hover:scale-105 active:scale-95"
      title="Ir para a ficha de ${escaparHTML(nome)}">
      <span>👤</span>
      <span class="underline decoration-emerald-500/40">${escaparHTML(nome)}</span>
    </a>`
  }

  return `<span class="inline-flex items-center gap-1 font-black text-slate-800 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-700/80 px-2 py-0.5 rounded-lg text-xs align-middle my-0.5">
    <span>👤</span>
    <span>${escaparHTML(nome)}</span>
  </span>`
}

function descreverRegistro(item: HistoricoItem): string {
  const dados = item.dados_depois || item.dados_antes || {}
  const botaoCliente = renderBotaoClienteInline(item)

  if (item.tabela === 'clientes') {
    const nomeFallback = String(dados.nome || item.cliente_nome || 'Cliente sem nome')
    const clienteElemento = botaoCliente || `<strong>${escaparHTML(nomeFallback)}</strong>`
    const tel = dados.telefone ? ` <span class="text-slate-500 font-normal">(${escaparHTML(String(dados.telefone))})</span>` : ''

    if (item.acao === 'criou') {
      return `Cadastrou o(a) cliente ${clienteElemento}${tel}`
    }
    if (item.acao === 'excluiu') {
      return `Excluiu o(a) cliente ${clienteElemento}${tel} e todo o seu histórico`
    }
    return `Editou dados cadastrais do(a) cliente ${clienteElemento}${tel}`
  }

  if (item.tabela === 'compras') {
    const prod = String(dados.produto || 'Produto')
    const val = Number(dados.valor) || 0
    const clienteTexto = botaoCliente ? ` para o(a) cliente ${botaoCliente}` : ''

    if (item.acao === 'criou') {
      return `Lançou o produto <strong>${escaparHTML(prod)}</strong> no valor de <strong>${formatarMoeda(val)}</strong>${clienteTexto}`
    }
    if (item.acao === 'excluiu') {
      return `Excluiu o produto <strong>${escaparHTML(prod)}</strong> no valor de <strong>${formatarMoeda(val)}</strong>${clienteTexto}`
    }
    return `Editou o produto <strong>${escaparHTML(prod)}</strong> no valor de <strong>${formatarMoeda(val)}</strong>${clienteTexto}`
  }

  if (item.tabela === 'pagamentos') {
    const val = Number(dados.valor) || 0
    const desc = dados.descricao ? ` <span class="text-slate-500">("${escaparHTML(String(dados.descricao))}")</span>` : ''
    const clienteTexto = botaoCliente ? ` do(a) cliente ${botaoCliente}` : ''

    if (item.acao === 'criou') {
      return `Registrou pagamento de <strong>${formatarMoeda(val)}</strong>${desc}${clienteTexto}`
    }
    if (item.acao === 'excluiu') {
      return `Excluiu pagamento de <strong>${formatarMoeda(val)}</strong>${desc}${clienteTexto}`
    }
    return `Editou pagamento de <strong>${formatarMoeda(val)}</strong>${desc}${clienteTexto}`
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
              placeholder="Buscar por cliente, produto, membro ou ID (#)..."
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
        const termoSemHash = termo.replace(/^#/, '')
        const textoCompleto = [
          String(item.id || ''),
          `#${item.id}`,
          item.registro_id || '',
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

        if (!textoCompleto.includes(termo) && !textoCompleto.includes(termoSemHash)) {
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
        const nomeAutor = item.usuario_nome || item.usuario_email?.split('@')[0] || 'Membro'
        const usuario = `<span class="font-bold text-slate-900 dark:text-white">${escaparHTML(nomeAutor)}</span>`

        return `
          <li class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-4 text-xs transition hover:border-slate-300 dark:hover:border-slate-600">
            <!-- Barra Superior: Ação + Autor + ID no Banco + Horário -->
            <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div class="flex items-center gap-2 flex-wrap min-w-0">
                ${badgeAcao(item.acao)}
                ${usuario}
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-copiar-id="${item.id}"
                  class="inline-flex items-center gap-1 text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md bg-slate-200/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-500/30 transition cursor-pointer active:scale-95"
                  title="ID na tabela 'historico' do banco: #${item.id} (Clique para copiar)">
                  <span class="text-slate-400 dark:text-slate-400 font-semibold">ID:</span><span>#${item.id}</span>
                </button>
                <span class="text-[11px] text-slate-400 font-medium">🕒 ${formatarDataHora(item.created_at)}</span>
              </div>
            </div>

            <!-- Descrição detalhada da alteração com o botão do cliente inserido inline -->
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

  listaEl.addEventListener('click', e => {
    const btnCopiar = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copiar-id]')
    if (btnCopiar) {
      const id = btnCopiar.dataset.copiarId
      if (id) {
        void navigator.clipboard?.writeText(id).then(() => {
          toast.success(`ID #${id} copiado para a área de transferência!`)
        }).catch(() => {
          toast.info(`ID da tabela histórico: #${id}`)
        })
      }
    }
  })

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
