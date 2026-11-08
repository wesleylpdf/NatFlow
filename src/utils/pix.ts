/**
 * Utilitário para geração de payload PIX padrão BR Code / EMV (Banco Central do Brasil).
 * Gera códigos "PIX Copia e Cola" estáticos compatíveis com todos os bancos
 * (Nubank, Inter, Itaú, Bradesco, Santander, Banco do Brasil, Mercado Pago, etc.).
 */

const DDDS_BRASIL = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24',
  '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46',
  '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '64', '63', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '87', '82', '83', '84', '85', '88', '86', '89',
  '91', '93', '94', '92', '97', '95', '96', '98', '99',
])

/**
 * Validação do dígito verificador de CPF (Módulo 11).
 */
export function validarCPF(cpf: string): boolean {
  const digitos = cpf.replace(/\D/g, '')
  if (digitos.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digitos)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digitos[i], 10) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(digitos[9], 10)) return false

  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digitos[i], 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(digitos[10], 10)) return false

  return true
}

/**
 * Normaliza qualquer chave PIX para o formato estrito exigido pelo Banco Central (BACEN / DICT / BR Code):
 * - Telefone Celular: Formato internacional E.164 iniciado por '+55' (ex: +5511999998888).
 *   Remove pontuações, parênteses e traços.
 * - CPF: 11 dígitos numéricos, sem pontos ou traço.
 * - CNPJ: 14 dígitos numéricos, sem pontuação.
 * - E-mail: Minúsculo, sem espaços.
 * - Chave Aleatória: Formato UUID minúsculo.
 */
export function normalizarChavePix(chaveBruta?: string | null): string {
  if (!chaveBruta) return ''
  const chave = chaveBruta.trim()
  if (!chave) return ''

  // 1. E-mail: contém '@'
  if (chave.includes('@')) {
    return chave.toLowerCase().replace(/\s+/g, '')
  }

  // 2. Chave Aleatória (EVP / UUID): 32 caracteres hexadecimais com hífens
  const semEspacos = chave.replace(/\s+/g, '')
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(semEspacos)) {
    return semEspacos.toLowerCase()
  }

  // 3. Chave já iniciada com '+' (ex: +5511999998888 ou +55 (11) 99999-9999)
  if (chave.startsWith('+')) {
    const digitos = chave.replace(/\D/g, '')
    return `+${digitos}`
  }

  const digitos = chave.replace(/\D/g, '')

  // 4. CNPJ: 14 dígitos numéricos
  if (digitos.length === 14) {
    return digitos
  }

  // 5. Telefone com DDI 55 (12 ou 13 dígitos começando com '55')
  // Ex: 5511999998888 (13 dígitos) ou 551133334444 (12 dígitos)
  if ((digitos.length === 13 || digitos.length === 12) && digitos.startsWith('55')) {
    return `+${digitos}`
  }

  // 6. Telefone com DDD (10 dígitos numéricos)
  // Ex: (11) 3333-4444 ou 1133334444
  if (digitos.length === 10) {
    return `+55${digitos}`
  }

  // 7. 11 dígitos: Celular com DDD ou CPF
  if (digitos.length === 11) {
    const ddd = digitos.slice(0, 2)
    const ehDddValido = DDDS_BRASIL.has(ddd)
    const terceiroDigitoEhNove = digitos[2] === '9'
    const temFormatacaoTelefone = /[() ]/.test(chave) || /^\d{2}-\d/.test(chave) || /-\d{4}$/.test(chave.trim())
    const temFormatacaoCpf = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(chave.trim())

    // Se possui indícios de formatação telefônica (parênteses, espaços, hífen de telefone) -> Telefone
    if (temFormatacaoTelefone && !temFormatacaoCpf) {
      return `+55${digitos}`
    }

    // Se possui máscara formal de CPF (000.000.000-00) -> CPF
    if (temFormatacaoCpf) {
      return digitos
    }

    const cpfValido = validarCPF(digitos)

    // Se não é um CPF válido e segue o padrão de celular (DDD válido + 9) -> É celular
    if (ehDddValido && terceiroDigitoEhNove && !cpfValido) {
      return `+55${digitos}`
    }

    // Se é um CPF matematicamente válido e não segue o padrão de celular -> É CPF
    if (cpfValido && (!ehDddValido || !terceiroDigitoEhNove)) {
      return digitos
    }

    // Se tem DDD e 9 (padrão de celular no Brasil)
    if (ehDddValido && terceiroDigitoEhNove) {
      return `+55${digitos}`
    }

    return digitos
  }

  return chave
}

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
  const chave = normalizarChavePix(dados.chavePix)
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
