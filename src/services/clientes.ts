import { supabase } from '@/lib/supabaseClient'
import type { Cliente, ClienteComSaldo, NovoCliente } from '@/types'

function normalizarSaldo(c: ClienteComSaldo): ClienteComSaldo {
  return {
    ...c,
    total_compras: Number(c.total_compras) || 0,
    total_pagamentos: Number(c.total_pagamentos) || 0,
    saldo_devedor: Number(c.saldo_devedor) || 0,
  }
}

/** Lista clientes com os totais calculados (view clientes_saldo). */
export async function listarClientesComSaldo(): Promise<ClienteComSaldo[]> {
  const { data, error } = await supabase
    .from('clientes_saldo')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw error
  return (data as ClienteComSaldo[]).map(normalizarSaldo)
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
