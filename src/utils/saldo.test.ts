import { describe, it, expect } from 'vitest'
import { calcularResumo } from './saldo'

describe('calcularResumo', () => {
  it('retorna zeros sem lançamentos', () => {
    expect(calcularResumo([], [])).toEqual({ totalCompras: 0, totalPagamentos: 0, saldoDevedor: 0 })
  })

  it('calcula saldo devedor como compras - pagamentos', () => {
    const r = calcularResumo([{ valor: 100 }, { valor: 59.9 }], [{ valor: 50 }])
    expect(r.totalCompras).toBe(159.9)
    expect(r.totalPagamentos).toBe(50)
    expect(r.saldoDevedor).toBe(109.9)
  })

  it('evita erro de ponto flutuante', () => {
    const r = calcularResumo([{ valor: 0.1 }, { valor: 0.2 }], [])
    expect(r.totalCompras).toBe(0.3)
  })

  it('saldo negativo quando cliente pagou a mais (crédito)', () => {
    const r = calcularResumo([{ valor: 30 }], [{ valor: 50 }])
    expect(r.saldoDevedor).toBe(-20)
  })
})
