import { describe, expect, it } from 'vitest'
import { calcularCRC16, gerarPixCopiaECola } from './pix'

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
})
