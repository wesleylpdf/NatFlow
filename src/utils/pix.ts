/**
 * Utilitário para geração de payload PIX padrão BR Code / EMV (Banco Central do Brasil).
 * Gera códigos "PIX Copia e Cola" estáticos compatíveis com todos os bancos
 * (Nubank, Inter, Itaú, Bradesco, Santander, Banco do Brasil, Mercado Pago, etc.).
 */

function normalizarTexto(texto: string, maxLen: number): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, maxLen)
}

function formatarCampo(id: string, valor: string): string {
  const len = valor.length.toString().padStart(2, '0')
  return `${id}${len}${valor}`
}

/**
 * Calcula o checksum CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 * exigido pela especificação EMV / BACEN para códigos QR PIX.
 */
export function calcularCRC16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export interface DadosPixPayload {
  chavePix: string
  nomeBeneficiario?: string
  cidadeBeneficiario?: string
  valor?: number
  identificador?: string
}

/**
 * Gera a string do código PIX Copia e Cola no formato padrão do Banco Central.
 */
export function gerarPixCopiaECola(dados: DadosPixPayload): string {
  const chave = dados.chavePix?.trim()
  if (!chave) return ''

  // Tag 00 - Payload Format Indicator (versão 01)
  const tag00 = formatarCampo('00', '01')

  // Tag 26 - Merchant Account Information (GUI + Chave PIX)
  const gui = formatarCampo('00', 'br.gov.bcb.pix')
  const tagChave = formatarCampo('01', chave)
  const tag26 = formatarCampo('26', `${gui}${tagChave}`)

  // Tag 52 - Merchant Category Code (0000 = padrão)
  const tag52 = formatarCampo('52', '0000')

  // Tag 53 - Transaction Currency (986 = Real BRL)
  const tag53 = formatarCampo('53', '986')

  // Tag 54 - Transaction Amount (se informado e maior que zero)
  let tag54 = ''
  if (typeof dados.valor === 'number' && dados.valor > 0) {
    const valorStr = dados.valor.toFixed(2)
    tag54 = formatarCampo('54', valorStr)
  }

  // Tag 58 - Country Code (BR)
  const tag58 = formatarCampo('58', 'BR')

  // Tag 59 - Merchant Name (máximo 25 caracteres, sem acentos)
  const nomeLimpo = normalizarTexto(dados.nomeBeneficiario || 'RECEBEDOR', 25) || 'RECEBEDOR'
  const tag59 = formatarCampo('59', nomeLimpo)

  // Tag 60 - Merchant City (máximo 15 caracteres, sem acentos)
  const cidadeLimpa = normalizarTexto(dados.cidadeBeneficiario || 'BRASIL', 15) || 'BRASIL'
  const tag60 = formatarCampo('60', cidadeLimpa)

  // Tag 62 - Additional Data Field Template (txid - padrão '***' para estático)
  const txid = normalizarTexto(dados.identificador || '***', 25) || '***'
  const tag62 = formatarCampo('62', formatarCampo('05', txid))

  // Tag 63 - CRC16 (4 caracteres hexadecimais)
  const payloadSemCRC = `${tag00}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`
  const crc = calcularCRC16(payloadSemCRC)

  return `${payloadSemCRC}${crc}`
}
