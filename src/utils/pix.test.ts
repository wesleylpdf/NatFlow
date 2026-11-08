import { describe, expect, it } from 'vitest'
import { calcularCRC16, gerarPixCopiaECola, normalizarChavePix, validarCPF } from './pix'

describe('pix util', () => {
  it('deve retornar string vazia se chave não for fornecida', () => {
    expect(gerarPixCopiaECola({ chavePix: '' })).toBe('')
    expect(gerarPixCopiaECola({ chavePix: '   ' })).toBe('')
  })

  it('deve gerar payload válido com chave e valor', () => {
    const payload = gerarPixCopiaECola({
      chavePix: '12345678900',
      nomeBeneficiario: 'Maria da Silva',
      cidadeBeneficiario: 'São Paulo',
      valor: 50.0,
    })

    expect(payload).toContain('000201')
    expect(payload).toContain('br.gov.bcb.pix')
    expect(payload).toContain('12345678900')
    expect(payload).toContain('540550.00')
    expect(payload).toContain('5802BR')
    expect(payload).toContain('MARIA DA SILVA')
    expect(payload).toContain('SAO PAULO')
    expect(payload).toContain('6304')
    expect(payload.length).toBeGreaterThan(50)

    // O CRC deve ser recalculado e coincidir exatamente
    const semCRC = payload.slice(0, -4)
    const crc = payload.slice(-4)
    expect(calcularCRC16(semCRC)).toBe(crc)
  })

  it('deve gerar payload válido sem valor', () => {
    const payload = gerarPixCopiaECola({
      chavePix: 'consultora@email.com',
      nomeBeneficiario: 'Ana Paula',
    })

    expect(payload).not.toContain('5405')
    expect(payload).toContain('consultora@email.com')
    const semCRC = payload.slice(0, -4)
    const crc = payload.slice(-4)
    expect(calcularCRC16(semCRC)).toBe(crc)
  })

  it('deve limitar nome a 25 caracteres e remover acentos', () => {
    const payload = gerarPixCopiaECola({
      chavePix: '+5511999998888',
      nomeBeneficiario: 'Maria Conceição Dos Santos Ferreira Longo',
      cidadeBeneficiario: 'Ribeirão Preto',
      valor: 15.5,
    })

    expect(payload).toContain('MARIA CONCEICAO DOS SANTO')
    expect(payload).toContain('RIBEIRAO PRETO')
  })

  describe('normalizarChavePix e suporte a celular (E.164)', () => {
    it('deve normalizar celular com máscara para o padrão internacional +55', () => {
      expect(normalizarChavePix('(11) 98765-4321')).toBe('+5511987654321')
      expect(normalizarChavePix('11 98765-4321')).toBe('+5511987654321')
      expect(normalizarChavePix('(85) 99999-8888')).toBe('+5585999998888')
    })

    it('deve normalizar celular sem pontuação (11 dígitos com DDD)', () => {
      expect(normalizarChavePix('11987654321')).toBe('+5511987654321')
      expect(normalizarChavePix('85999998888')).toBe('+5585999998888')
    })

    it('deve normalizar celular que já tem 55 ou +55', () => {
      expect(normalizarChavePix('+5511987654321')).toBe('+5511987654321')
      expect(normalizarChavePix('+55 (11) 98765-4321')).toBe('+5511987654321')
      expect(normalizarChavePix('5511987654321')).toBe('+5511987654321')
    })

    it('deve normalizar telefone fixo (10 dígitos)', () => {
      expect(normalizarChavePix('(11) 3333-4444')).toBe('+551133334444')
      expect(normalizarChavePix('1133334444')).toBe('+551133334444')
    })

    it('deve normalizar CPF com máscara mantendo 11 dígitos', () => {
      expect(normalizarChavePix('123.456.789-00')).toBe('12345678900')
    })

    it('deve normalizar CNPJ com ou sem máscara para 14 dígitos', () => {
      expect(normalizarChavePix('12.345.678/0001-90')).toBe('12345678000190')
      expect(normalizarChavePix('12345678000190')).toBe('12345678000190')
    })

    it('deve normalizar e-mail para minúsculo e sem espaços', () => {
      expect(normalizarChavePix('  Contato@Loja.Com.Br  ')).toBe('contato@loja.com.br')
    })

    it('deve normalizar chave aleatória UUID para minúsculo', () => {
      expect(
        normalizarChavePix('  A1B2C3D4-E5F6-7890-ABCD-EF1234567890 ')
      ).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    })

    it('deve gerar código PIX Copia e Cola compatível quando a chave for celular com parênteses', () => {
      const payload = gerarPixCopiaECola({
        chavePix: '(11) 98765-4321',
        nomeBeneficiario: 'Consultora Natura',
        cidadeBeneficiario: 'Sao Paulo',
        valor: 75.0,
      })

      // O payload deve conter a tag 01 com o tamanho 14 e valor +5511987654321
      expect(payload).toContain('0114+5511987654321')
      // NÃO deve conter caracteres ilegais como parênteses ou traço
      expect(payload).not.toContain('(')
      expect(payload).not.toContain(')')

      // O CRC deve ser válido
      const semCRC = payload.slice(0, -4)
      const crc = payload.slice(-4)
      expect(calcularCRC16(semCRC)).toBe(crc)
    })
  })

  describe('validarCPF', () => {
    it('deve validar CPFs corretamente', () => {
      expect(validarCPF('11111111111')).toBe(false)
      expect(validarCPF('12345678900')).toBe(false)
      expect(validarCPF('52998224725')).toBe(true) // CPF válido de teste
    })
  })
})
