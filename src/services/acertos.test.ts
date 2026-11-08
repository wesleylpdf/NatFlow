import { describe, it, expect } from 'vitest'
import { parseDescricaoParcela, formatarDescricaoParcela } from './acertos'

describe('parseDescricaoParcela e formatarDescricaoParcela', () => {
  it('identifica corretamente "Parcela 1/3"', () => {
    const info = parseDescricaoParcela('Parcela 1/3')
    expect(info).not.toBeNull()
    expect(info?.prefixo).toBe('')
    expect(info?.temParenteses).toBe(false)
    expect(info?.indiceAntigo).toBe(1)
    expect(info?.totalAntigo).toBe(3)
  })

  it('identifica corretamente "Compra Natura (2/3)"', () => {
    const info = parseDescricaoParcela('Compra Natura (2/3)')
    expect(info).not.toBeNull()
    expect(info?.prefixo).toBe('Compra Natura')
    expect(info?.temParenteses).toBe(true)
    expect(info?.indiceAntigo).toBe(2)
    expect(info?.totalAntigo).toBe(3)
  })

  it('identifica "1/3" simples', () => {
    const info = parseDescricaoParcela('1/3')
    expect(info).not.toBeNull()
    expect(info?.indiceAntigo).toBe(1)
    expect(info?.totalAntigo).toBe(3)
  })

  it('retorna null para descrições sem padrão de fração', () => {
    expect(parseDescricaoParcela('Entrada em dinheiro')).toBeNull()
    expect(parseDescricaoParcela('Pagamento PIX')).toBeNull()
    expect(parseDescricaoParcela(null)).toBeNull()
  })

  it('formata nova descrição renumerada sem parenteses', () => {
    expect(formatarDescricaoParcela('', false, 1, 2)).toBe('Parcela 1/2')
    expect(formatarDescricaoParcela('', false, 2, 2)).toBe('Parcela 2/2')
    expect(formatarDescricaoParcela('', false, 1, 1)).toBe('Parcela 1/1')
  })

  it('formata nova descrição renumerada com parenteses', () => {
    expect(formatarDescricaoParcela('Compra Natura', true, 1, 2)).toBe('Compra Natura (1/2)')
    expect(formatarDescricaoParcela('Compra Natura', true, 2, 2)).toBe('Compra Natura (2/2)')
  })
})
