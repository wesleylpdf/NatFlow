import { supabase } from '@/lib/supabaseClient'
import type { Autorizado, PapelUsuario } from '@/types'

let perfilCache: Autorizado | null = null

function obterBeneficiarioLocal(email: string): string | null {
  try {
    return localStorage.getItem(`natflow_beneficiario_pix_${email.toLowerCase()}`) || null
  } catch {
    return null
  }
}

function salvarBeneficiarioLocal(email: string, valor: string | null): void {
  try {
    if (valor) {
      localStorage.setItem(`natflow_beneficiario_pix_${email.toLowerCase()}`, valor)
    } else {
      localStorage.removeItem(`natflow_beneficiario_pix_${email.toLowerCase()}`)
    }
  } catch {
    // storage opcional
  }
}

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

  const emailLimpo = user.email.toLowerCase()
  const { data, error } = await supabase
    .from('autorizados')
    .select('*')
    .eq('email', emailLimpo)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    perfilCache = null
    return null
  }

  const autorizado = { ...(data as Autorizado) }
  // Fallback para beneficiario_pix do localStorage se o banco ainda não tiver o campo
  if (!autorizado.beneficiario_pix) {
    const local = obterBeneficiarioLocal(emailLimpo)
    if (local) autorizado.beneficiario_pix = local
  }

  perfilCache = autorizado
  return perfilCache
}

export function limparCachePerfil(): void {
  perfilCache = null
}

/**
 * Atualiza o próprio perfil (nome, chave PIX e beneficiário do PIX) do usuário autenticado.
 * Garante que a edição do PIX não altere o nome do usuário a menos que nome seja explicitamente fornecido.
 */
export async function atualizarMeuPerfil(dados: {
  nome?: string
  chave_pix?: string | null
  beneficiario_pix?: string | null
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) throw new Error('Usuário não autenticado')

  const emailLimpo = user.email.toLowerCase()
  const payload: Record<string, unknown> = {}
  if (dados.nome !== undefined) payload.nome = dados.nome.trim()
  if (dados.chave_pix !== undefined) payload.chave_pix = dados.chave_pix?.trim() || null

  if (dados.beneficiario_pix !== undefined) {
    const ben = dados.beneficiario_pix?.trim() || null
    payload.beneficiario_pix = ben
    salvarBeneficiarioLocal(emailLimpo, ben)
  }

  // Tenta atualizar no Supabase com beneficiario_pix
  let { error } = await supabase
    .from('autorizados')
    .update(payload)
    .eq('email', emailLimpo)

  // Fallback resiliente: se a coluna beneficiario_pix ainda não existir no banco (erro 42703 ou PGRST204)
  if (error && (error.code === '42703' || error.message?.includes('beneficiario_pix'))) {
    console.warn('[Equipe] Coluna beneficiario_pix inexistente no Supabase, mantendo no storage local.')
    delete payload.beneficiario_pix
    const ret = await supabase
      .from('autorizados')
      .update(payload)
      .eq('email', emailLimpo)
    error = ret.error
  }

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
  const lista = ((data as Autorizado[]) || []).map(m => {
    if (!m.beneficiario_pix) {
      const local = obterBeneficiarioLocal(m.email)
      if (local) return { ...m, beneficiario_pix: local }
    }
    return m
  })
  return lista
}

/**
 * Adiciona um novo membro autorizado à equipe
 */
export async function adicionarMembro(dados: {
  email: string
  nome: string
  papel: PapelUsuario
  chave_pix?: string | null
  beneficiario_pix?: string | null
}): Promise<void> {
  const emailLimpo = dados.email.trim().toLowerCase()
  const payload: Record<string, unknown> = {
    email: emailLimpo,
    nome: dados.nome.trim(),
    papel: dados.papel,
    chave_pix: dados.chave_pix?.trim() || null,
    ativo: true,
  }

  if (dados.beneficiario_pix !== undefined) {
    const ben = dados.beneficiario_pix?.trim() || null
    payload.beneficiario_pix = ben
    salvarBeneficiarioLocal(emailLimpo, ben)
  }

  let { error } = await supabase.from('autorizados').insert(payload)
  if (error && (error.code === '42703' || error.message?.includes('beneficiario_pix'))) {
    delete payload.beneficiario_pix
    const ret = await supabase.from('autorizados').insert(payload)
    error = ret.error
  }

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
    beneficiario_pix?: string | null
  }
): Promise<void> {
  const payload: Record<string, unknown> = { ...dados }
  let { error } = await supabase
    .from('autorizados')
    .update(payload)
    .eq('id', id)

  if (error && (error.code === '42703' || error.message?.includes('beneficiario_pix'))) {
    delete payload.beneficiario_pix
    const ret = await supabase
      .from('autorizados')
      .update(payload)
      .eq('id', id)
    error = ret.error
  }

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
