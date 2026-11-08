export interface ItemChangelog {
  versao: string
  data: string
  titulo: string
  destaque?: boolean
  adicionado?: string[]
  alterado?: string[]
  removido?: string[]
}

export const CHANGELOG: ItemChangelog[] = [
  {
    versao: 'v1.2.32',
    data: '08/11/2026',
    titulo: 'Limpeza e Otimização do Modal de Atualizações',
    destaque: true,
    alterado: [
      'Botão "Verificar Atualizações no Servidor" expandido para ocupar toda a largura com layout limpo.'
    ],
    removido: [
      'Botão de teste temporário de notificação removido após a validação em produção.'
    ]
  },
  {
    versao: 'v1.2.30',
    data: '08/11/2026',
    titulo: 'Central de Notificações e Verificação de Atualizações',
    adicionado: [
      'Banner destacado de nova versão com opções de atualizar instantaneamente ou consultar o que mudou.',
      'Botão "🔍 Verificar Atualizações" no modal da versão no cabeçalho.'
    ],
    alterado: [
      'Notificação pós-carregamento ajustada para garantir visibilidade com a tela pronta e carregada.'
    ]
  },
  {
    versao: 'v1.2.27',
    data: '08/11/2026',
    titulo: 'Layout Otimizado do Cronograma de Acertos',
    alterado: [
      'Título "Cronograma de Acertos" posicionado no topo, acima dos botões de ação.',
      'Botões "Parcelar Saldo" e "Novo Acerto" alinhados lado a lado na mesma linha sem quebra de linha.'
    ]
  },
  {
    versao: 'v1.2.26',
    data: '08/11/2026',
    titulo: 'Histórico de Atualizações Interativo no Cabeçalho',
    adicionado: [
      'Versão no topo agora é um botão clicável que exibe a central de novidades e histórico de versões do NatFlow.',
      'Modal moderno com divisão clara entre Novidades (✨), Alterações/Melhorias (🔄) e Itens Removidos (🗑️).'
    ]
  },
  {
    versao: 'v1.2.25',
    data: '08/11/2026',
    titulo: 'Bordas Vivas e Cores Nítidas nos Cards de Clientes',
    alterado: [
      'Bordas reforçadas (border-2) e fundos em cores sólidas nos cards da lista para facilitar a visualização no celular e desktop.',
      'Alerta pulsante em laranja (animate-pulse) para acertos com vencimento no dia de hoje.',
      'Destaque com anel em vermelho forte para acertos vencidos e em atraso.'
    ]
  },
  {
    versao: 'v1.2.24',
    data: '08/11/2026',
    titulo: 'Visual Exclusivo para Clientes Em Dia e Sem Acerto',
    adicionado: [
      'Card verde esmeralda exclusivo e limpo para clientes "Em dia", sem exibir caixas de acerto desnecessárias.',
      'Padrão pontilhado com aviso "⚠️ Nenhum acerto cadastrado" para clientes devedores que ainda não têm promessa ou parcelamento registrado.'
    ]
  },
  {
    versao: 'v1.2.23',
    data: '08/11/2026',
    titulo: 'Rodapé Responsivo de Acertos no Card',
    alterado: [
      'Informações do próximo acerto reposicionadas em uma faixa dedicada no rodapé do card, impedindo sobreposição e quebra de texto em telas menores de celular.'
    ]
  },
  {
    versao: 'v1.2.22',
    data: '08/11/2026',
    titulo: 'Subtítulo Inteligente com Próximo Acerto',
    adicionado: [
      'Exibição automática da data, valor e quantidade de parcelas restantes (ex: "Próximo acerto: 15/11 (R$ 150,00) • 2 restantes") no card do cliente.'
    ]
  },
  {
    versao: 'v1.2.21',
    data: '07/11/2026',
    titulo: 'Edição Individual de Parcelas e Simplificação de Menus',
    adicionado: [
      'Edição livre de data, valor e identificação de cada parcela diretamente na lista de conferência antes de salvar o parcelamento.',
      'Validador de distribuição de valores em tempo real para evitar erros matemáticos.'
    ],
    removido: [
      'Botão redundante "🗓️ Combinar Data" na barra de ações superior, unificando toda a gestão dentro do Cronograma de Acertos.'
    ]
  },
  {
    versao: 'v1.2.20',
    data: '07/11/2026',
    titulo: 'Cronograma de Acertos e Parcelamento Inteligente',
    adicionado: [
      'Módulo de Cronograma de Acertos com agendamento múltiplo de parcelas (mensal, quinzenal ou semanal).',
      'Baixa automática inteligente: qualquer pagamento registrado pelo cliente abate em cascata os acertos pendentes mais antigos.',
      'Sincronização instantânea na nuvem (Supabase) com contingência offline no navegador.'
    ]
  },
  {
    versao: 'v1.2.19',
    data: '06/11/2026',
    titulo: 'Mensagens de WhatsApp 100% Limpas',
    alterado: [
      'Remoção de caracteres e asteriscos literais nas mensagens enviadas aos clientes pelo WhatsApp.',
      'Padronização amigável de cobrança e comprovante com "na Natura" e "Chave PIX".'
    ]
  },
  {
    versao: 'v1.2.18',
    data: '05/11/2026',
    titulo: 'Extrato Detalhado do Cliente em PDF',
    adicionado: [
      'Emissão de extrato financeiro completo e estilizado em PDF, pronto para impressão ou compartilhamento digital com o cliente.'
    ]
  },
  {
    versao: 'v1.2.17',
    data: '04/11/2026',
    titulo: 'Gestão de Consultoras e Chave PIX Pessoal',
    adicionado: [
      'Controle de perfil da consultora pelo cabeçalho com cadastro e edição da Chave PIX pessoal e beneficiário.',
      'Integração automática da Chave PIX nos textos de cobrança do WhatsApp.'
    ]
  }
]
