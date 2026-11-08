import { describe, it, expect } from 'vitest'
import {
  calcularDataFutura,
  calcularDiasAtraso,
  obterStatusPromessa,
  escaparHTML,
  extrairPrimeiroNome,
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

  it('extrairPrimeiroNome - trata sobrenomes antes do nome, vírgulas e emails', () => {
    // Nome simples e com sobrenome
    expect(extrairPrimeiroNome('Wesley')).toBe('Wesley')
    expect(extrairPrimeiroNome('Wesley Ferreira')).toBe('Wesley')
    expect(extrairPrimeiroNome('Wesley da Silva Ferreira')).toBe('Wesley')

    // Formato com vírgula (Sobrenome, Nome)
    expect(extrairPrimeiroNome('Ferreira, Wesley')).toBe('Wesley')
    expect(extrairPrimeiroNome('Silva, João')).toBe('João')

    // Sobrenome comum cadastrado antes do primeiro nome (sem vírgula)
    expect(extrairPrimeiroNome('Ferreira Wesley')).toBe('Wesley')
    expect(extrairPrimeiroNome('Silva João')).toBe('João')

    // Título ou prefixo
    expect(extrairPrimeiroNome('Dr. Wesley Silva')).toBe('Wesley')

    // E-mail com sobrenome comum primeiro
    expect(extrairPrimeiroNome('ferreira.wesley@exemplo.com')).toBe('Wesley')
    expect(extrairPrimeiroNome('silva.joao@exemplo.com')).toBe('Joao')

    // E-mail com nome primeiro
    expect(extrairPrimeiroNome('wesley.ferreira@exemplo.com')).toBe('Wesley')
    expect(extrairPrimeiroNome('ana.paula@exemplo.com')).toBe('Ana')

    // Com mapa
    const mapa = new Map([
      ['wesleylpdf@gmail.com', 'Wesley Ferreira'],
      ['editor@empresa.com', 'Ferreira, Wesley'],
    ])
    expect(extrairPrimeiroNome('wesleylpdf@gmail.com', mapa)).toBe('Wesley')
    expect(extrairPrimeiroNome('editor@empresa.com', mapa)).toBe('Wesley')
  })

  it('formatarAutoriaResumida', () => {
    // Com fallback de e-mail direto (pega primeiro identificador capitalizado)
    expect(formatarAutoriaResumida({ criado_por: 'ana@exemplo.com' })).toBe('Por Ana')
    expect(
      formatarAutoriaResumida({
        criado_por: 'ana@exemplo.com',
        atualizado_por: 'joao@exemplo.com',
      })
    ).toBe('Por Ana • Editado por Joao')
    expect(formatarAutoriaResumida({})).toBe('Por desconhecido')

    // Com mapa de membros cadastrados (pega apenas o primeiro nome ignorando sobrenomes)
    const mapa = new Map([
      ['wesley@exemplo.com', 'Wesley Silva Ferreira'],
      ['camila@exemplo.com', 'Camila Rodrigues'],
    ])
    expect(
      formatarAutoriaResumida(
        {
          criado_por: 'wesley@exemplo.com',
          atualizado_por: 'camila@exemplo.com',
        },
        mapa
      )
    ).toBe('Por Wesley • Editado por Camila')
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

  it('obterStatusPromessa', () => {
    const hoje = '2026-11-06'
    expect(obterStatusPromessa(null, hoje)).toBeNull()
    expect(obterStatusPromessa('data-invalida', hoje)).toBeNull()

    const hojeRes = obterStatusPromessa('2026-11-06', hoje)
    expect(hojeRes?.status).toBe('vence_hoje')
    expect(hojeRes?.rotulo).toBe('⏰ Promessa Vence Hoje!')

    const vencidaRes = obterStatusPromessa('2026-11-01', hoje)
    expect(vencidaRes?.status).toBe('vencida')
    expect(vencidaRes?.rotulo).toContain('🚨 Promessa Vencida em 01/11/2026')

    const futuraRes = obterStatusPromessa('2026-11-15', hoje)
    expect(futuraRes?.status).toBe('a_vencer')
    expect(futuraRes?.rotulo).toContain('🗓️ Acerto: 15/11/2026')
  })

  it('calcularDataFutura calcula datas por intervalo', () => {
    const base = '2026-11-01'
    expect(calcularDataFutura(base, 'mensal', 0)).toBe('2026-11-01')
    expect(calcularDataFutura(base, 'quinzenal', 1)).toBe('2026-11-16')
    expect(calcularDataFutura(base, 'semanal', 1)).toBe('2026-11-08')
    expect(calcularDataFutura(base, 'mensal', 1)).toBe('2026-12-01')
    expect(calcularDataFutura(base, 'mensal', 2)).toBe('2027-01-01')
  })
})
