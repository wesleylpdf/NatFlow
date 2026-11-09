import type { FormaPagamento } from '@/types'

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

const SOBRENOMES_COMUNS = new Set([
  'albuquerque', 'almeida', 'alves', 'andrade', 'antunes', 'araujo', 'araújo',
  'azevedo', 'barbosa', 'barros', 'bezerra', 'borges', 'branco', 'brito',
  'caldeira', 'camargo', 'campos', 'cardoso', 'carvalho', 'castro', 'cavalcanti',
  'coelho', 'correia', 'costa', 'cunha', 'dias', 'duarte', 'farias', 'fernandes',
  'ferreira', 'figueiredo', 'franco', 'freitas', 'garcia', 'gomes', 'goncalves',
  'gonçalves', 'guedes', 'lima', 'lopes', 'macedo', 'machado', 'magalhaes',
  'magalhães', 'marques', 'martins', 'medeiros', 'mello', 'melo', 'mendes',
  'miranda', 'monteiro', 'moraes', 'morais', 'moreira', 'moura', 'nascimento',
  'neves', 'nogueira', 'nunes', 'oliveira', 'paiva', 'peixoto', 'pereira',
  'pinheiro', 'pinto', 'pires', 'queiroz', 'ramos', 'reis', 'resende',
  'rezende', 'ribeiro', 'rocha', 'rodrigues', 'sales', 'santana', 'santos',
  'silva', 'silveira', 'soares', 'sousa', 'souza', 'tavares', 'teixeira',
  'vargas', 'vasconcelos', 'viana', 'vieira', 'xavier'
])

/**
 * Extrai o primeiro nome de um autor/usuário (ignorando qualquer coisa após o primeiro espaço).
 * Se receber um e-mail, busca o nome cadastrado no cache ou mapa e extrai o primeiro nome.
 * Trata inteligentemente sobrenomes registrados antes do primeiro nome (ex: "Ferreira, Wesley", "Ferreira Wesley",
 * ou e-mails no formato "sobrenome.nome@...").
 */
export function extrairPrimeiroNome(
  nomeOuEmail?: string | null,
  mapaNomes?: Map<string, string>
): string {
  if (!nomeOuEmail) return 'desconhecido'
  const valor = nomeOuEmail.trim()
  if (!valor) return 'desconhecido'

  let nomeCompleto = valor

  if (valor.includes('@')) {
    const emailLimpo = valor.toLowerCase().trim()
    let doMapa = mapaNomes?.get(emailLimpo)

    // Se não encontrou exato no mapa, tenta busca case-insensitive e por chave sem domínio
    if (!doMapa && mapaNomes) {
      for (const [k, v] of mapaNomes.entries()) {
        const kLimpo = k.toLowerCase().trim()
        if (kLimpo === emailLimpo || kLimpo.split('@')[0] === emailLimpo.split('@')[0]) {
          doMapa = v
          break
        }
      }
    }

    let doCache: string | null = null
    try {
      if (typeof localStorage !== 'undefined') {
        doCache = localStorage.getItem(`natflow_nome_${emailLimpo}`)
        if (!doCache) {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.toLowerCase().startsWith('natflow_nome_')) {
              const emailK = k.slice('natflow_nome_'.length).toLowerCase().trim()
              if (emailK === emailLimpo || emailK.split('@')[0] === emailLimpo.split('@')[0]) {
                doCache = localStorage.getItem(k)
                break
              }
            }
          }
        }
      }
    } catch {
      // storage opcional
    }

    if (doMapa) {
      nomeCompleto = doMapa
    } else if (doCache) {
      nomeCompleto = doCache
    } else {
      // Se não houver nome cadastrado no mapa ou cache, extrai do e-mail
      const parteEmail = valor.split('@')[0].trim()
      const partes = parteEmail.split(/[._-]+/).filter(Boolean)
      if (partes.length >= 2) {
        const p0 = partes[0].toLowerCase()
        const p1 = partes[1].toLowerCase()
        // Se a primeira parte for um sobrenome comum, o primeiro nome é a segunda parte (ex: ferreira.wesley)
        if (SOBRENOMES_COMUNS.has(p0) && !['da', 'de', 'do', 'dos', 'das', 'e'].includes(p1)) {
          nomeCompleto = partes[1]
        } else {
          nomeCompleto = partes[0]
        }
      } else if (partes.length === 1) {
        nomeCompleto = partes[0]
      }
    }
  }

  // Se o nome estiver no formato "Sobrenome, Nome"
  if (nomeCompleto.includes(',')) {
    const partes = nomeCompleto.split(',')
    const depoisVirgula = partes[1]?.trim()
    if (depoisVirgula) {
      nomeCompleto = depoisVirgula
    }
  }

  // Remove títulos e prefixos como Dr., Dra., Sr., Sra., Prof.
  nomeCompleto = nomeCompleto.replace(/^(dr|dra|sr|sra|prof|profa)\.?\s+/i, '')

  // Pega as palavras separadas por espaço
  const palavras = nomeCompleto.trim().split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return 'desconhecido'

  let primeiroNome = palavras[0]

  // Se foram informadas 2 ou mais palavras e a primeira for um sobrenome comum brasileiro (ex: "Ferreira Wesley", "Silva João")
  // e a segunda palavra não for sufixo de família nem conector, pega a segunda palavra como primeiro nome!
  if (palavras.length >= 2) {
    const p0 = palavras[0].toLowerCase().replace(/[^a-zA-ZÀ-ÿ]/g, '')
    const p1 = palavras[1].toLowerCase().replace(/[^a-zA-ZÀ-ÿ]/g, '')
    const conectoresOuSufixos = ['da', 'de', 'do', 'dos', 'das', 'e', 'junior', 'filho', 'neto', 'sobrinho', 'segundo', 'terceiro']
    if (SOBRENOMES_COMUNS.has(p0) && !conectoresOuSufixos.includes(p1)) {
      primeiroNome = palavras[1]
    }
  }

  // Remove caracteres especiais ou pontuações residuais
  primeiroNome = primeiroNome.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '')
  if (!primeiroNome) return 'desconhecido'

  return primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase()
}

/**
 * Retorna texto curto de autoria com o primeiro nome de quem criou / editou
 */
export function formatarAutoriaResumida(
  item: {
    criado_por?: string | null
    atualizado_por?: string | null
    atualizado_em?: string | null
  },
  mapaNomes?: Map<string, string>
): string {
  const autor = extrairPrimeiroNome(item.criado_por, mapaNomes)
  if (item.atualizado_por) {
    const editor = extrairPrimeiroNome(item.atualizado_por, mapaNomes)
    return `Por ${autor} • Editado por ${editor}`
  }
  return `Por ${autor}`
}

/**
 * Link do WhatsApp para o telefone (assume Brasil, +55) com mensagem opcional
 */
export function linkWhatsApp(telefone: string, mensagem?: string): string | null {
  const d = telefone.replace(/\D/g, '')
  if (d.length < 10) return null
  const textoQuery = mensagem ? `&text=${encodeURIComponent(mensagem)}` : ''
  return `https://api.whatsapp.com/send?phone=55${d}${textoQuery}`
}

export interface InfoFormaPagamento {
  id: FormaPagamento
  label: string
  icone: string
  corBadge: string
}

export const FORMAS_PAGAMENTO: InfoFormaPagamento[] = [
  {
    id: 'pix',
    label: 'PIX',
    icone: '💠',
    corBadge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  {
    id: 'dinheiro',
    label: 'Dinheiro',
    icone: '💵',
    corBadge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  },
  {
    id: 'credito',
    label: 'Crédito',
    icone: '💳',
    corBadge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  },
  {
    id: 'debito',
    label: 'Débito',
    icone: '💳',
    corBadge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
  },
  {
    id: 'outro',
    label: 'Outro',
    icone: '🏷️',
    corBadge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  },
]

export function obterInfoFormaPagamento(forma?: string | null): InfoFormaPagamento {
  const normalizada = (forma || 'pix').toLowerCase()
  const encontrada = FORMAS_PAGAMENTO.find(f => f.id === normalizada)
  if (encontrada) return encontrada
  return {
    id: 'outro',
    label: forma || 'Outro',
    icone: '🏷️',
    corBadge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  }
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function nomeMes(mes: number): string {
  return MESES[mes - 1] || ''
}

export function formatarMesAno(ano: number, mes: number): string {
  return `${nomeMes(mes)} de ${ano}`
}

/**
 * Calcula a quantidade de dias de atraso a partir de uma data ISO (AAAA-MM-DD).
 */
export function calcularDiasAtraso(dataReferenciaISO?: string | null, dataHoje: Date = new Date()): number {
  if (!dataReferenciaISO) return 0
  const [ano, mes, dia] = dataReferenciaISO.slice(0, 10).split('-').map(Number)
  if (!ano || !mes || !dia) return 0
  const dataRef = new Date(ano, mes - 1, dia)
  const hoje = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate())
  dataRef.setHours(0, 0, 0, 0)
  hoje.setHours(0, 0, 0, 0)
  const diffMs = hoje.getTime() - dataRef.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export type StatusPromessa = 'vence_hoje' | 'vencida' | 'a_vencer'

export interface InfoStatusPromessa {
  status: StatusPromessa
  rotulo: string
  corBadge: string
}

/**
 * Retorna o status e badge visual para uma data de promessa de pagamento.
 */
export function obterStatusPromessa(
  dataPromessa?: string | null,
  hojeRef: string = hojeISO()
): InfoStatusPromessa | null {
  if (!dataPromessa) return null
  const dataLimpa = dataPromessa.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataLimpa)) return null

  if (dataLimpa === hojeRef) {
    return {
      status: 'vence_hoje',
      rotulo: '⏰ Promessa Vence Hoje!',
      corBadge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    }
  } else if (dataLimpa < hojeRef) {
    return {
      status: 'vencida',
      rotulo: `🚨 Promessa Vencida em ${formatarData(dataLimpa)}`,
      corBadge: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
    }
  } else {
    return {
      status: 'a_vencer',
      rotulo: `🗓️ Acerto: ${formatarData(dataLimpa)}`,
      corBadge: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
    }
  }
}

/**
 * Calcula uma data futura baseada em um intervalo ('quinzenal' | 'mensal' | 'semanal')
 * e na quantidade de incrementos.
 */
export function calcularDataFutura(
  dataBase: string,
  intervalo: 'quinzenal' | 'mensal' | 'semanal',
  incremento: number
): string {
  if (incremento === 0) return dataBase
  const [ano, mes, dia] = dataBase.split('-').map(Number)
  if (intervalo === 'quinzenal') {
    const d = new Date(ano, mes - 1, dia)
    d.setDate(d.getDate() + 15 * incremento)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dt = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dt}`
  }
  if (intervalo === 'semanal') {
    const d = new Date(ano, mes - 1, dia)
    d.setDate(d.getDate() + 7 * incremento)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dt = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dt}`
  }
  // mensal
  const d = new Date(ano, mes - 1 + incremento, dia)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dt = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dt}`
}


