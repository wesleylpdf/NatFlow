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
    versao: 'v1.2.46',
    data: '08/11/2026',
    titulo: 'Lembrete de Parcela no WhatsApp e Gerador de PIX Copia e Cola',
    destaque: true,
    adicionado: [
      'Botão de 1 toque no card da parcela pendente (💬) para enviar lembrete amigável no WhatsApp direto para o cliente.',
      'Geração automática do código padrão oficial do Banco Central (PIX Copia e Cola / BR Code) com o valor exato da parcela ou do saldo devedor.',
      'O cliente só precisa tocar para copiar o código no WhatsApp e colar no app do banco (Nubank, Inter, Itaú, etc.), já com valor e beneficiário preenchidos.',
      'Design compacto e otimizado para celulares pequenos sem poluir a visualização do Cronograma de Acertos.'
    ]
  },
  {
    versao: 'v1.2.45',
    data: '08/11/2026',
    titulo: 'Compatibilidade com Node.js 22 e Estabilidade na Integração Contínua (CI)',
    destaque: false,
    alterado: [
      'Atualização do ambiente de Integração Contínua (GitHub Actions CI) para Node.js 22 LTS, eliminando avisos de depreciação do Node 20.',
      'Suporte nativo a WebSocket habilitado no pipeline de testes e build.',
      'Camada defensiva de compatibilidade em ambientes headless e de teste para conexão com Supabase.'
    ]
  },
  {
    versao: 'v1.2.44',
    data: '08/11/2026',
    titulo: 'Sincronização Bidirecional e Inteligente na Edição de Pagamentos',
    destaque: false,
    adicionado: [
      'Janela exclusiva e moderna para edição de pagamentos com cálculo de diferença em tempo real.',
      'Sincronização automática com o Cronograma: se o pagamento for reduzido, a diferença é devolvida para a parcela; se for aumentado, o valor extra é abatido da parcela.',
      'Explicação dinâmica na tela enquanto você digita o novo valor, indicando exatamente o que acontecerá com o Cronograma de Acertos.',
      'Caixa de seleção "Sincronizar alteração no Cronograma de Acertos" permitindo ao usuário escolher se deseja ou não sincronizar as parcelas.'
    ]
  },
  {
    versao: 'v1.2.43',
    data: '08/11/2026',
    titulo: 'Recomposição Precisa de Valor em Parcela Existente ao Excluir Pagamento',
    destaque: false,
    alterado: [
      'Garantia de recomposição na parcela existente: ao excluir um pagamento, o valor é devolvido diretamente para a parcela ou acerto já existente que havia sido abatido, evitando criar novos acertos duplicados.',
      'Identificação transparente no modal de exclusão mostrando exatamente qual parcela receberá o valor de volta e o valor resultante (ex: passará de R$ 30 para R$ 50).'
    ]
  },
  {
    versao: 'v1.2.42',
    data: '08/11/2026',
    titulo: 'Restauração Inteligente de Parcelas ao Excluir Pagamento',
    destaque: false,
    adicionado: [
      'Janela interativa de confirmação ao excluir pagamento com opção "Restaurar valor no Cronograma de Acertos" (ativada por padrão).',
      'Restauração inteligente de valores parciais: o valor do pagamento excluído é somado de volta na parcela correspondente.',
      'Recriação automática de parcelas que foram 100% quitadas com renumeração dinâmica e preservação da data.',
      'Liberdade de escolha: se o usuário preferir, pode desmarcar a opção e excluir apenas o pagamento sem alterar o Cronograma.'
    ]
  },
  {
    versao: 'v1.2.41',
    data: '08/11/2026',
    titulo: 'Visualização de Novidades Antes de Atualizar',
    destaque: false,
    adicionado: [
      'Visualização imediata das novidades: ao clicar em "Novidades" na notificação de atualização, o histórico agora puxa em tempo real o que mudou na nova versão antes de recarregar.',
      'Destaque no modal indicando a nova versão disponível no servidor e a versão atualmente instalada na aba.',
      'Botão "Instalar Agora" direto dentro do card da nova versão no modal de novidades.'
    ]
  },
  {
    versao: 'v1.2.39',
    data: '08/11/2026',
    titulo: 'Abatimento Inteligente em Cascata e Parcial de Parcelas',
    destaque: false,
    adicionado: [
      'Abatimento parcial inteligente: pagamentos avulsos menores que o acerto agora abatem diretamente o valor da parcela (ex: de R$ 50 para R$ 20), mantendo a data combinada.',
      'Abatimento em cascata cronológica: pagamentos avulsos que cobrem uma ou mais parcelas baixam as quitadas do Cronograma e reduzem a próxima pelo valor excedente.',
      'Botão "⚖️ Ajustar ao Saldo" no Cronograma caso o total agendado seja superior ao saldo devedor do cliente.',
      'Limpeza automática inteligente de acertos pendentes caso o saldo do cliente seja totalmente zerado.'
    ],
    alterado: [
      'Clique nos botões de atalho de parcelas no formulário de pagamento agora permite alternar a seleção (clique para selecionar, clique novamente para desmarcar).',
      'Unificação total entre baixas manuais e avulsas com renumeração dinâmica automática de parcelas.'
    ]
  },
  {
    versao: 'v1.2.38',
    data: '08/11/2026',
    titulo: 'Modernização do Sistema: Aposentadoria da Coluna data_promessa',
    destaque: false,
    removido: [
      'Remoção definitiva do campo legado "data_promessa" na tabela de clientes e no schema do banco.',
      'Eliminação de métodos legados de sincronização no frontend.',
      'Transição 100% concluída para a arquitetura moderna da tabela "acertos" (Cronograma de Acertos).'
    ],
    alterado: [
      'Exportação de extratos PDF, mensagens de lembrete de cobrança via WhatsApp e backups em CSV agora utilizam nativamente os dados consolidados do Cronograma de Acertos.'
    ]
  },
  {
    versao: 'v1.2.36',
    data: '08/11/2026',
    titulo: 'Quitação Direta de Parcelas no Cronograma de Acertos',
    destaque: false,
    adicionado: [
      'Ícone e botão direto de quitação (💰 Quitar) em cada card de parcela do Cronograma de Acertos.',
      'Modal de confirmação detalhado com aviso do que será feito (lançamento do pagamento, abatimento do saldo e exclusão/baixa da parcela).',
      'Opção para selecionar a forma de pagamento (PIX, Dinheiro, Cartão) e botões de Confirmar ou Cancelar.'
    ]
  },
  {
    versao: 'v1.2.35',
    data: '08/11/2026',
    titulo: 'Atalhos Rápidos de Parcelas em Pagamentos e Baixa Automática',
    adicionado: [
      'Botões de atalho individuais para cada parcela ou acerto pendente cadastrado no formulário de Pagamentos.',
      'Preenchimento instantâneo de valor e descrição ao clicar no atalho da parcela correspondente.',
      'Baixa automática inteligente: ao lançar o pagamento, a parcela é excluída do Cronograma e as parcelas restantes são renumeradas automaticamente.'
    ],
    removido: [
      'Botão "50%" removido do formulário de pagamento para dar lugar aos atalhos das parcelas reais.'
    ]
  },
  {
    versao: 'v1.2.34',
    data: '08/11/2026',
    titulo: 'Correção e Sincronização Dinâmica do Parcelamento de Acertos',
    alterado: [
      'Renumeração inteligente de parcelas: ao excluir qualquer parcela, as restantes são atualizadas automaticamente (ex: de 1/3 e 2/3 passam a ser 1/2 e 2/2).',
      'Remoção de parcelas individuais no próprio modal de parcelamento com botão ✕ e renumeração em tempo real.',
      'Novo botão "⚖️ Redistribuir total igualmente" no modal de parcelamento para recalcular valores proporcionais com um clique.',
      'Alerta na ficha do cliente indicando saldo devedor restante caso os acertos não cubram o saldo total.'
    ]
  },
  {
    versao: 'v1.2.33',
    data: '08/11/2026',
    titulo: 'Identificador (ID) do Histórico para Consulta no Banco',
    adicionado: [
      'Exibição nítida do ID da tabela "historico" (#ID) em cada item da tela de Histórico de Alterações.',
      'Clique no ID para copiá-lo instantaneamente para a área de transferência.',
      'Campo de busca atualizado para permitir pesquisar alterações diretamente pelo número do ID.'
    ]
  },
  {
    versao: 'v1.2.32',
    data: '08/11/2026',
    titulo: 'Limpeza e Otimização do Modal de Atualizações',
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
