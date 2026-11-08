export type PapelUsuario = 'admin' | 'membro'

export interface Autorizado {
  id: string
  email: string
  nome: string
  papel: PapelUsuario
  ativo: boolean
  chave_pix?: string | null
  beneficiario_pix?: string | null
  created_at: string
  criado_por?: string | null
  atualizado_por?: string | null
  atualizado_em?: string | null
}

export interface AutoriaCampos {
  criado_por?: string | null
  created_at: string
  atualizado_por?: string | null
  atualizado_em?: string | null
}

export interface Cliente extends AutoriaCampos {
  id: string
  nome: string
  telefone: string
  data_promessa?: string | null
}

export interface ClienteComSaldo extends Cliente {
  total_compras: number
  total_pagamentos: number
  saldo_devedor: number
  ultimo_pagamento?: string | null
  ultima_compra?: string | null
  primeira_compra?: string | null
  dias_atraso?: number
  proximo_acerto_data?: string | null
  proximo_acerto_valor?: number | null
  qtd_acertos_pendentes?: number
}

/** Saída: produto comprado pelo cliente. */
export interface Compra extends AutoriaCampos {
  id: string
  cliente_id: string
  produto: string
  valor: number
  data: string
}

export type FormaPagamento = 'pix' | 'dinheiro' | 'credito' | 'debito' | 'outro'

export type StatusAcerto = 'pendente' | 'pago' | 'cancelado'

/** Acerto combinado com o cliente (parcela ou promessa de pagamento) */
export interface Acerto extends AutoriaCampos {
  id: string
  cliente_id: string
  data: string
  valor: number
  descricao?: string | null
  status: StatusAcerto
  pago_em?: string | null
}

export type NovoAcerto = Pick<Acerto, 'cliente_id' | 'data' | 'valor'> & {
  descricao?: string | null
}

/** Entrada: valor pago pelo cliente. */
export interface Pagamento extends AutoriaCampos {
  id: string
  cliente_id: string
  valor: number
  data: string
  descricao: string | null
  forma_pagamento?: FormaPagamento | string | null
}

export interface HistoricoItem {
  id: number
  tabela: 'clientes' | 'compras' | 'pagamentos' | 'autorizados'
  acao: 'criou' | 'editou' | 'excluiu'
  registro_id: string
  cliente_id?: string | null
  cliente_nome?: string | null
  usuario_email: string
  usuario_nome?: string | null
  dados_antes?: Record<string, unknown> | null
  dados_depois?: Record<string, unknown> | null
  created_at: string
}

export type NovoCliente = Pick<Cliente, 'nome' | 'telefone'>
export type NovaCompra = Pick<Compra, 'cliente_id' | 'produto' | 'valor' | 'data'>
export type NovoPagamento = Pick<Pagamento, 'cliente_id' | 'valor' | 'data' | 'descricao'> & {
  forma_pagamento?: FormaPagamento | string | null
}

export interface ResumoCliente {
  totalCompras: number
  totalPagamentos: number
  saldoDevedor: number
}

export interface ItemCatalogo {
  produto: string
  valorSugerido: number
  frequencia: number
  ultimoUso: string
}

export interface ResumoFinanceiro {
  totalRecebido: number
  totalVendido: number
  saldoPeriodo: number
  porFormaPagamento: Record<string, number>
  quantidadePagamentos: number
  quantidadeVendas: number
}
