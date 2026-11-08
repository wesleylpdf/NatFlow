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

describe('lógica de abatimento em cascata de parcelas', () => {
  it('calcula corretamente o abatimento parcial de uma parcela', () => {
    const valorParcela = 50.0
    const valorPago = 30.0
    const novoValor = Math.round((valorParcela - valorPago) * 100) / 100
    expect(novoValor).toBe(20.0)
  })

  it('calcula cascata quando pagamento cobre uma parcela e sobra para a próxima', () => {
    const parcelas = [
      { id: '1', valor: 30.0 },
      { id: '2', valor: 30.0 },
      { id: '3', valor: 29.0 },
    ]
    let saldoDisponivel = 45.0
    const quitadas: string[] = []
    let parcial: { id: string; novoValor: number } | null = null

    for (const p of parcelas) {
      if (saldoDisponivel <= 0.009) break
      if (saldoDisponivel >= p.valor - 0.05) {
        saldoDisponivel -= p.valor
        quitadas.push(p.id)
      } else {
        parcial = { id: p.id, novoValor: Math.round((p.valor - saldoDisponivel) * 100) / 100 }
        saldoDisponivel = 0
        break
      }
    }

    expect(quitadas).toEqual(['1'])
    expect(parcial).toEqual({ id: '2', novoValor: 15.0 })
    expect(saldoDisponivel).toBe(0)
  })
})
