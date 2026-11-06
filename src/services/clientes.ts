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

  return lista
}

/** Lista clientes (apenas id, nome, telefone) ordenados por nome. */
export async function listarClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw error
  return data as Cliente[]
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

/** Exclui o cliente e (em cascata) todas as compras e pagamentos dele. */
export async function excluirCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw error
}
