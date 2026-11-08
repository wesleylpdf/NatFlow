import { abrirFormModal, confirmar } from '@/components/Modal'
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientesComSaldo,
} from '@/services/clientes'
import { carregarMapaMembros, obterPerfilAtual } from '@/services/equipe'
import { enviarLembreteCobrancaWhatsApp } from '@/utils/exportarPdf'
import type { ClienteComSaldo } from '@/types'
import {
  escaparHTML,
  formatarAutoriaResumida,
  formatarData,
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
 * Tela inicial: cadastro e lista completa de clientes com filtros rápidos e ações diretas.
 */
export async function renderClientes(container: HTMLElement): Promise<void> {
  container.innerHTML = loadingHTML()

  let clientes: ClienteComSaldo[]
  let mapaMembros = new Map<string, string>()
  try {
    const [listaClientes, mapa] = await Promise.all([
      listarClientesComSaldo(),
      carregarMapaMembros(),
    ])
    clientes = listaClientes
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

  const recarregar = async (): Promise<void> => {
    try {
      ;[clientes, mapaMembros] = await Promise.all([
        listarClientesComSaldo(),
        carregarMapaMembros(),
      ])
      renderLista()
      const contador = container.querySelector('#contador-clientes')
      if (contador) contador.textContent = `(${clientes.length})`
    } catch (e) {
      toast.error(mensagemErro(e, 'Erro ao atualizar clientes'))
    }
  }

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">
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

  // Toggle do acordeão: Clientes
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

  function renderLista(): void {
    const termo = normalizarBusca(busca.trim())
    const termoDigitos = busca.replace(/\D/g, '')

    const filtrados = clientes.filter(c => {
      // Regras de filtro por status
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
          // 1. Cliente Em Dia (Verde Esmeralda destacado)
          estiloCard =
            'border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 shadow-sm'
          estiloAvatar = 'bg-emerald-600 text-white font-black'
        } else if (infoPromessa && dataPromessa) {
          // 2. Cliente Devedor COM acerto cadastrado
          const dataFormatada = formatarData(dataPromessa).slice(0, 5) // DD/MM
          const valorFormatado = c.proximo_acerto_valor ? ` (${formatarMoeda(c.proximo_acerto_valor)})` : ''
          const qtdRestante =
            c.qtd_acertos_pendentes && c.qtd_acertos_pendentes > 1
              ? ` • ${c.qtd_acertos_pendentes} parcelas`
              : ''

          if (infoPromessa.status === 'vencida') {
            estiloCard =
              'border-2 border-rose-500 bg-rose-50/70 hover:bg-rose-100/70 dark:border-rose-500/80 dark:bg-rose-950/40 shadow-sm'
            estiloAvatar = 'bg-rose-500 text-white font-black'
          } else if (infoPromessa.status === 'vence_hoje') {
            estiloCard =
              'border-2 border-amber-500 bg-amber-50/70 hover:bg-amber-100/70 dark:border-amber-500/80 dark:bg-amber-950/40 shadow-sm'
            estiloAvatar = 'bg-amber-500 text-slate-950 font-black'
          } else {
            estiloCard =
              'border-2 border-sky-400 bg-sky-50/70 hover:bg-sky-100/70 dark:border-sky-500/80 dark:bg-sky-950/40 shadow-sm'
            estiloAvatar = 'bg-sky-600 text-white font-black'
          }

          subtituloAcerto = `
          <div class="flex items-center gap-1.5 text-xs font-bold ${
            infoPromessa.status === 'vencida'
              ? 'text-rose-700 dark:text-rose-300'
              : infoPromessa.status === 'vence_hoje'
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-sky-800 dark:text-sky-300'
          }">
            <span class="text-sm shrink-0">${infoPromessa.status === 'vencida' ? '🚨' : infoPromessa.status === 'vence_hoje' ? '⏰' : '🗓️'}</span>
            <span class="truncate">Próximo acerto: ${dataFormatada}${valorFormatado}${qtdRestante}</span>
          </div>`
        } else {
          // 3. Cliente Devedor SEM acerto cadastrado
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
        <li data-card-cliente="${c.id}" class="group flex flex-col ${estiloCard} rounded-2xl p-3 transition space-y-2 cursor-pointer hover:shadow-md active:scale-[0.99]">
          <!-- Linha 1: [Avatar] Nome do Cliente (11) 99999-9999 -->
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-full ${estiloAvatar} flex items-center justify-center font-black text-sm shrink-0">
              ${escaparHTML(c.nome.trim().charAt(0).toUpperCase())}
            </div>
            <div class="min-w-0 flex-1 flex items-baseline gap-2 flex-wrap">
              <span class="font-bold text-sm text-slate-900 dark:text-white truncate">${escaparHTML(c.nome)}</span>
              <span class="text-xs text-slate-500 dark:text-slate-400 truncate font-normal">${c.telefone ? escaparHTML(c.telefone) : 'Sem telefone'}</span>
            </div>
          </div>

          <!-- Linha 2 (Ações com botões de 32x32px para o polegar + Badge de status à direita): -->
          <div class="flex items-center justify-between gap-2 pt-0.5">
            <div class="flex items-center gap-2">
              ${
                c.telefone
                  ? `<button type="button" data-whats-cliente="${c.id}" class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition shadow-xs cursor-pointer" title="Abrir WhatsApp">
                      <span class="text-sm">💬</span>
                    </button>`
                  : ''
              }
              <button type="button" data-editar="${c.id}" class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 active:scale-95 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30 transition shadow-xs cursor-pointer" title="Editar cliente">
                <span class="text-sm">✏️</span>
              </button>
              <button type="button" data-excluir="${c.id}" class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-700 dark:text-rose-300 border border-rose-500/30 transition shadow-xs cursor-pointer" title="Excluir cliente">
                <span class="text-sm">🗑️</span>
              </button>
            </div>
            <div class="shrink-0">
              ${badgeSaldo(c.saldo_devedor, c.dias_atraso)}
            </div>
          </div>

          <!-- Linha 3: Autoria em linha própria -->
          <div class="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
            ${formatarAutoriaResumida(c, mapaMembros)}
          </div>

          <!-- Linha 4: Final com informações dos acertos -->
          ${
            temRodape
              ? `
            <div class="mt-1 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-1 text-left">
              ${subtituloAcerto}
              ${avisoAtraso}
            </div>
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
    renderLista()
  })

  // Event delegation com suporte a card 100% clicável
  listaEl.addEventListener('click', async e => {
    const alvoBotao = (e.target as HTMLElement).closest<HTMLElement>('button')
    if (alvoBotao) {
      // 1. WhatsApp
      const btnWhats = alvoBotao.closest<HTMLElement>('[data-whats-cliente]')
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

      // 2. Editar
      const btnEditar = alvoBotao.closest<HTMLElement>('[data-editar]')
      if (btnEditar) {
        e.preventDefault()
        e.stopPropagation()
        const id = btnEditar.dataset.editar!
        const cliente = clientes.find(c => c.id === id)
        if (cliente) abrirEdicaoCliente(cliente, recarregar)
        return
      }

      // 3. Excluir
      const btnExcluir = alvoBotao.closest<HTMLElement>('[data-excluir]')
      if (btnExcluir) {
        e.preventDefault()
        e.stopPropagation()
        const id = btnExcluir.dataset.excluir!
        const cliente = clientes.find(c => c.id === id)
        if (!cliente) return

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
        return
      }
    }

    // Se clicou em qualquer outra parte do card (áreas vazias, avatar, nome, autoria, rodapé):
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-card-cliente]')
    if (card) {
      const id = card.dataset.cardCliente
      if (id) {
        window.location.hash = `#/cliente/${id}`
      }
    }
  })

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
