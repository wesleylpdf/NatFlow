/**
 * Formata valor monetário em BRL
 */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formata data ISO (AAAA-MM-DD) para DD/MM/AAAA
 */
export function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return dataISO
  return `${dia}/${mes}/${ano}`
}

/**
 * Data de hoje no fuso local, formato AAAA-MM-DD (para inputs type="date")
 */
export function hojeISO(agora: Date = new Date()): string {
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Escapa string para uso seguro em HTML (previne XSS)
 */
export function escaparHTML(str: string | null | undefined): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Converte texto digitado em valor numérico.
 * Aceita "10", "10.5", "10,50", "1.234,56" e "R$ 1.234,56".
 * Retorna NaN se não for um número válido.
 */
export function parseValor(texto: string): number {
  let limpo = texto.replace(/R\$|\s/g, '')
  if (!limpo) return NaN
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.')
  }
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return NaN
  return Math.round(parseFloat(limpo) * 100) / 100
}

/**
 * Valor numérico para exibir no input de edição ("1234.5" -> "1234,50")
 */
export function valorParaInput(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

/**
 * Aplica máscara de telefone brasileiro: (11) 91234-5678 / (11) 1234-5678
 */
export function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/**
 * Formata data e hora ISO para DD/MM/AAAA às HH:mm
 */
export function formatarDataHora(dataISO: string): string {
  try {
    const d = new Date(dataISO)
    if (isNaN(d.getTime())) return dataISO
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const ano = d.getFullYear()
    const hora = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dia}/${mes}/${ano} às ${hora}:${min}`
  } catch {
    return dataISO
  }
}

/**
 * Retorna texto curto de autoria para exibir em listas e cards
 */
export function formatarAutoriaResumida(item: {
  criado_por?: string | null
  atualizado_por?: string | null
  atualizado_em?: string | null
}): string {
  const autor = item.criado_por ? item.criado_por.split('@')[0] : 'desconhecido'
  if (item.atualizado_por) {
    const editor = item.atualizado_por.split('@')[0]
    return `Por ${autor} • Editado por ${editor}`
  }
  return `Por ${autor}`
}

/**
 * Link do WhatsApp para o telefone (assume Brasil, +55)
 */
export function linkWhatsApp(telefone: string): string | null {
  const d = telefone.replace(/\D/g, '')
  if (d.length < 10) return null
  return `https://api.whatsapp.com/send?phone=55${d}`
}
