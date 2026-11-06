import { supabase } from '@/lib/supabaseClient'
import type { Autorizado, PapelUsuario } from '@/types'

let perfilCache: Autorizado | null = null

/**
 * Retorna os dados do membro logado na tabela autorizados
 */
export async function obterPerfilAtual(forcarAtualizacao = false): Promise<Autorizado | null> {
  if (perfilCache && !forcarAtualizacao) {
    return perfilCache
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    perfilCache = null
    return null
  }

  const { data, error } = await supabase
    .from('autorizados')
    .select('*')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (error) throw error
  perfilCache = (data as Autorizado) || null
  return perfilCache
}

export function limparCachePerfil(): void {
  perfilCache = null
}

/**
 * Atualiza o próprio perfil (nome e chave PIX) do usuário autenticado
 */
export async function atualizarMeuPerfil(dados: {
  nome?: string
  chave_pix?: string | null
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) throw new Error('Usuário não autenticado')

  const payload: Record<string, unknown> = {}
  if (dados.nome !== undefined) payload.nome = dados.nome.trim()
  if (dados.chave_pix !== undefined) payload.chave_pix = dados.chave_pix?.trim() || null

  const { error } = await supabase
    .from('autorizados')
    .update(payload)
    .eq('email', user.email.toLowerCase())

  if (error) throw error
  limparCachePerfil()
}

/**
 * Lista todos os membros autorizados (ordem de criação)
 */
export async function listarEquipe(): Promise<Autorizado[]> {
  const { data, error } = await supabase
    .from('autorizados')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as Autorizado[]) || []
}

/**
 * Adiciona um novo membro autorizado à equipe
 */
export async function adicionarMembro(dados: {
  email: string
  nome: string
  papel: PapelUsuario
  chave_pix?: string | null
}): Promise<void> {
  const { error } = await supabase.from('autorizados').insert({
    email: dados.email.trim().toLowerCase(),
    nome: dados.nome.trim(),
    papel: dados.papel,
    chave_pix: dados.chave_pix?.trim() || null,
    ativo: true,
  })
  if (error) throw error
}

/**
 * Atualiza dados ou status de um membro da equipe
 */
export async function atualizarMembro(
  id: string,
  dados: {
    nome?: string
    papel?: PapelUsuario
    ativo?: boolean
    chave_pix?: string | null
  }
): Promise<void> {
  const { error } = await supabase
    .from('autorizados')
    .update(dados)
    .eq('id', id)
  if (error) throw error
  limparCachePerfil()
}

/**
 * Remove um membro da lista de autorizados
 */
export async function removerMembro(id: string): Promise<void> {
  const { error } = await supabase.from('autorizados').delete().eq('id', id)
  if (error) throw error
  limparCachePerfil()
}
