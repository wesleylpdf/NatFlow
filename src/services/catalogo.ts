import { supabase } from '@/lib/supabaseClient'
import type { ItemCatalogo } from '@/types'

let cacheCatalogo: ItemCatalogo[] | null = null
let ultimaAtualizacao = 0
const TTL_CACHE_MS = 60 * 1000 // 1 minuto

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Invalida o cache do catálogo (chamado ao criar, editar ou excluir compras).
 */
export function limparCacheCatalogo(): void {
  cacheCatalogo = null
  ultimaAtualizacao = 0
}

/**
 * Carrega todos os produtos únicos da base com valor mais recente e frequência de uso.
 */
async function carregarCatalogo(): Promise<ItemCatalogo[]> {
  const agora = Date.now()
  if (cacheCatalogo && agora - ultimaAtualizacao < TTL_CACHE_MS) {
    return cacheCatalogo
  }

  // Busca compras recentes para mapear produtos usados
  const { data, error } = await supabase
    .from('compras')
    .select('produto, valor, data')
    .order('data', { ascending: false })
    .limit(500)

  if (error) {
    console.warn('[Catalogo] Erro ao carregar itens de compras:', error)
    return cacheCatalogo || []
  }

  const mapa = new Map<
    string,
    { produto: string; valorMaisRecente: number; contagem: number; ultimaData: string }
  >()

  for (const item of data || []) {
    const nomeLimpo = (item.produto || '').trim()
    if (!nomeLimpo) continue
    const chave = normalizarTexto(nomeLimpo)

    const existente = mapa.get(chave)
    if (!existente) {
      mapa.set(chave, {
        produto: nomeLimpo,
        valorMaisRecente: Number(item.valor) || 0,
        contagem: 1,
        ultimaData: item.data || '',
      })
    } else {
      existente.contagem++
      // Como a consulta é DESC por data, o primeiro registro encontrado já é o mais recente
    }
  }

  const itens: ItemCatalogo[] = Array.from(mapa.values())
    .map(val => ({
      produto: val.produto,
      valorSugerido: val.valorMaisRecente,
      frequencia: val.contagem,
      ultimoUso: val.ultimaData,
    }))
    .sort((a, b) => {
      // Prioriza os mais frequentes; desempata pelos mais recentes
      if (b.frequencia !== a.frequencia) return b.frequencia - a.frequencia
      return b.ultimoUso.localeCompare(a.ultimoUso)
    })

  cacheCatalogo = itens
  ultimaAtualizacao = agora
  return itens
}

/**
 * Retorna sugestões de produtos conforme o usuário digita.
 * Se o termo estiver vazio, retorna os itens mais populares.
 */
export async function obterSugestoesCatalogo(termo: string = '', limite: number = 6): Promise<ItemCatalogo[]> {
  const itens = await carregarCatalogo()
  const busca = normalizarTexto(termo)

  if (!busca) {
    return itens.slice(0, limite)
  }

  return itens
    .filter(item => normalizarTexto(item.produto).includes(busca))
    .slice(0, limite)
}
