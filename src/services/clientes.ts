import { supabase } from '@/lib/supabaseClient'
import type { Cliente, ClienteComSaldo, NovoCliente } from '@/types'
import { calcularDiasAtraso } from '@/utils/format'

function normalizarSaldo(c: ClienteComSaldo): ClienteComSaldo {
  return {
    ...c,
    total_compras: Number(c.total_compras) || 0,
    total_pagamentos: Number(c.total_pagamentos) || 0,
    saldo_devedor: Number(c.saldo_devedor) || 0,
    dias_atraso: 0,
  }
}

/** Lista clientes com os totais calculados (view clientes_saldo) e cálculo de dias de atraso. */
export async function listarClientesComSaldo(): Promise<ClienteComSaldo[]> {
  const { data, error } = await supabase
    .from('clientes_saldo')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw error

  const lista = (data as ClienteComSaldo[]).map(normalizarSaldo)

  // Encontra devedores para calcular tempo de atraso sem pagamentos
  const devedores = lista.filter(c => c.saldo_devedor > 0)
  if (devedores.length > 0) {
    const devedoresIds = devedores.map(c => c.id)
    try {
      const [{ data: pags }, { data: comps }] = await Promise.all([
        supabase
          .from('pagamentos')
          .select('cliente_id, data')
          .in('cliente_id', devedoresIds)
          .order('data', { ascending: false }),
        supabase
          .from('compras')
          .select('cliente_id, data')
          .in('cliente_id', devedoresIds)
          .order('data', { ascending: true }),
      ])

      const ultimoPagMap = new Map<string, string>()
      for (const p of pags || []) {
        if (!ultimoPagMap.has(p.cliente_id)) {
          ultimoPagMap.set(p.cliente_id, p.data)
        }
      }

      const primeiraCompMap = new Map<string, string>()
      const ultimaCompMap = new Map<string, string>()
      for (const c of comps || []) {
        if (!primeiraCompMap.has(c.cliente_id)) {
          primeiraCompMap.set(c.cliente_id, c.data)
        }
        ultimaCompMap.set(c.cliente_id, c.data)
      }

      for (const cli of lista) {
        if (cli.saldo_devedor > 0) {
          const ultPag = cli.ultimo_pagamento || ultimoPagMap.get(cli.id)
          const primComp = cli.primeira_compra || primeiraCompMap.get(cli.id)
          const ultComp = cli.ultima_compra || ultimaCompMap.get(cli.id)

          cli.ultimo_pagamento = ultPag || null
          cli.primeira_compra = primComp || null
          cli.ultima_compra = ultComp || null

          // Data base: último pagamento recebido, ou primeira compra em aberto se nunca pagou
          const dataBase = ultPag || primComp || ultComp || (cli.created_at ? cli.created_at.slice(0, 10) : null)
          cli.dias_atraso = calcularDiasAtraso(dataBase)
        } else {
          cli.dias_atraso = 0
        }
      }
    } catch (err) {
      console.warn('[Clientes] Erro ao carregar datas para cálculo de atraso:', err)
    }
  }

  // Preenche data de promessa do localStorage se não vier na view
  for (const cli of lista) {
    if (!cli.data_promessa && typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(`natflow_promessa_${cli.id}`)
      if (local) cli.data_promessa = local
    }
  }

  return lista
}

/** Lista clientes (apenas id, nome, telefone, data_promessa) ordenados por nome. */
export async function listarClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw error
  const lista = data as Cliente[]
  for (const cli of lista) {
    if (!cli.data_promessa && typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(`natflow_promessa_${cli.id}`)
      if (local) cli.data_promessa = local
    }
  }
  return lista
}

export async function criarCliente(dados: NovoCliente): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .insert({ nome: dados.nome.trim(), telefone: dados.telefone.trim() })
    .select()
    .single()
  if (error) throw error
  return data as Cliente
}

export async function atualizarCliente(id: string, dados: NovoCliente): Promise<void> {
  const { error } = await supabase
    .from('clientes')
    .update({ nome: dados.nome.trim(), telefone: dados.telefone.trim() })
    .eq('id', id)
  if (error) throw error
}

/** Define ou remove a data de promessa de pagamento acordada com o cliente. */
export async function definirDataPromessa(clienteId: string, dataPromessa: string | null): Promise<void> {
  const promessaValida = dataPromessa && dataPromessa.trim() ? dataPromessa.trim() : null

  if (typeof localStorage !== 'undefined') {
    if (promessaValida) {
      localStorage.setItem(`natflow_promessa_${clienteId}`, promessaValida)
    } else {
      localStorage.removeItem(`natflow_promessa_${clienteId}`)
    }
  }

  try {
    const { error } = await supabase
      .from('clientes')
      .update({ data_promessa: promessaValida })
      .eq('id', clienteId)
    if (error) {
      console.warn('[Clientes] data_promessa mantida localmente (banco aguarda migration):', error.message)
    }
  } catch (err) {
    console.warn('[Clientes] Exceção ao atualizar data_promessa no banco:', err)
  }
}

/** Exclui o cliente e (em cascata) todas as compras e pagamentos dele. */
export async function excluirCliente(id: string): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(`natflow_promessa_${id}`)
  }
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw error
}
