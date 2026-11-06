import { describe, it, expect } from 'vitest'
import {
  calcularDiasAtraso,
  escaparHTML,
  formatarAutoriaResumida,
  formatarData,
  formatarDataHora,
  formatarMesAno,
  formatarTelefone,
  hojeISO,
  linkWhatsApp,
  nomeMes,
  obterInfoFormaPagamento,
  parseValor,
  valorParaInput,
} from './format'

describe('parseValor', () => {
  it('aceita formatos comuns', () => {
    expect(parseValor('10')).toBe(10)
    expect(parseValor('10.5')).toBe(10.5)
    expect(parseValor('10,50')).toBe(10.5)
    expect(parseValor('1.234,56')).toBe(1234.56)
    expect(parseValor('R$ 1.234,56')).toBe(1234.56)
  })

  it('retorna NaN para entradas inválidas', () => {
    expect(parseValor('')).toBeNaN()
    expect(parseValor('abc')).toBeNaN()
    expect(parseValor('1,2,3')).toBeNaN()
  })
})

describe('formatadores', () => {
  it('formatarData', () => {
    expect(formatarData('2026-11-06')).toBe('06/11/2026')
  })

  it('hojeISO', () => {
    expect(hojeISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('valorParaInput', () => {
    expect(valorParaInput(1234.5)).toBe('1234,50')
  })

  it('formatarTelefone', () => {
    expect(formatarTelefone('11912345678')).toBe('(11) 91234-5678')
    expect(formatarTelefone('1112345678')).toBe('(11) 1234-5678')
    expect(formatarTelefone('11')).toBe('(11')
    expect(formatarTelefone('')).toBe('')
  })

  it('linkWhatsApp', () => {
    expect(linkWhatsApp('(11) 91234-5678')).toBe('https://api.whatsapp.com/send?phone=5511912345678')
    expect(linkWhatsApp('123')).toBeNull()
  })

  it('escaparHTML', () => {
    expect(escaparHTML('<b>"a" & \'b\'</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;')
    expect(escaparHTML(null)).toBe('')
  })

  it('formatarAutoriaResumida', () => {
    expect(formatarAutoriaResumida({ criado_por: 'ana@exemplo.com' })).toBe('Por ana')
    expect(
      formatarAutoriaResumida({
        criado_por: 'ana@exemplo.com',
        atualizado_por: 'joao@exemplo.com',
      })
    ).toBe('Por ana • Editado por joao')
    expect(formatarAutoriaResumida({})).toBe('Por desconhecido')
  })

  it('formatarDataHora', () => {
    const res = formatarDataHora('2026-11-06T14:30:00Z')
    expect(res).toContain('06/11/2026')
  })

  it('nomeMes e formatarMesAno', () => {
    expect(nomeMes(1)).toBe('Janeiro')
    expect(nomeMes(11)).toBe('Novembro')
    expect(formatarMesAno(2026, 3)).toBe('Março de 2026')
  })

  it('obterInfoFormaPagamento', () => {
    expect(obterInfoFormaPagamento('pix').label).toBe('PIX')
    expect(obterInfoFormaPagamento('dinheiro').label).toBe('Dinheiro')
    expect(obterInfoFormaPagamento('credito').icone).toBe('💳')
    expect(obterInfoFormaPagamento(null).id).toBe('pix')
    expect(obterInfoFormaPagamento('desconhecido').id).toBe('outro')
  })

  it('calcularDiasAtraso', () => {
    const hoje = new Date(2026, 10, 6) // 06/11/2026
    expect(calcularDiasAtraso('2026-11-06', hoje)).toBe(0)
    expect(calcularDiasAtraso('2026-11-05', hoje)).toBe(1)
    expect(calcularDiasAtraso('2026-10-07', hoje)).toBe(30)
    expect(calcularDiasAtraso('2026-09-07', hoje)).toBe(60)
    expect(calcularDiasAtraso(null, hoje)).toBe(0)
    expect(calcularDiasAtraso('data-invalida', hoje)).toBe(0)
  })
})
