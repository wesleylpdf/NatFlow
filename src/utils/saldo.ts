import type { Compra, Pagamento, ResumoCliente } from '@/types'

/** Soma valores evitando erros de ponto flutuante (trabalha em centavos). */
function somar(valores: number[]): number {
  const centavos = valores.reduce((acc, v) => acc + Math.round(Number(v) * 100), 0)
  return centavos / 100
}

/**
 * Calcula o resumo financeiro de um cliente.
 * - Saídas: total de produtos comprados
 * - Entradas: total de valores pagos
 * - Saldo devedor: saídas - entradas (negativo = cliente tem crédito)
 */
export function calcularResumo(
  compras: Pick<Compra, 'valor'>[],
  pagamentos: Pick<Pagamento, 'valor'>[]
): ResumoCliente {
  const totalCompras = somar(compras.map(c => c.valor))
  const totalPagamentos = somar(pagamentos.map(p => p.valor))
  const saldoDevedor = Math.round((totalCompras - totalPagamentos) * 100) / 100
  return { totalCompras, totalPagamentos, saldoDevedor }
}
