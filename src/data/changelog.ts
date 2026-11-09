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
    versao: 'v1.3.14',
    data: '09/11/2026',
    titulo: 'Simplificação de Formas de Pagamento e Remoção da Barra Visual',
    destaque: true,
    alterado: [
      'Removida a barra visual empilhada de formas de pagamento no Resumo Financeiro para um layout mais enxuto e direto.',
      'Removida a forma de pagamento "Outro" de todos os formulários e filtros do sistema, mantendo apenas as formas oficiais: PIX, Dinheiro, Cartão de Crédito e Cartão de Débito.',
      'Grid de entradas por forma de pagamento no Resumo Financeiro readequado para 4 colunas perfeitamente alinhadas.'
    ]
  },
  {
    versao: 'v1.3.13',
    data: '09/11/2026',
    titulo: 'Fechamento Automático do Teclado ao Selecionar Sugestão de Produto',
    destaque: true,
    alterado: [
      'Ao tocar em uma sugestão de produto na aba de compras, o teclado virtual do celular agora fecha automaticamente, pois o nome e o valor já são preenchidos por completo, deixando a tela limpa para o botão de lançamento.'
    ]
  },
  {
    versao: 'v1.3.12',
    data: '09/11/2026',
    titulo: 'Topo Compacto com Destaque no Saldo e Busca Inteligente nos Históricos',
    destaque: true,
    alterado: [
      'Painel do Topo Otimizado: as 3 caixas grandes de produtos, pagamentos e saldo foram unificadas em um card compacto com o Saldo Devedor em grande destaque visual e os totais de compras e pagamentos em subtítulos limpos.',
      'Busca e Ordenação Condicional: a barra de pesquisa e ordenação não é mais exibida para clientes com poucos lançamentos (menos de 5), eliminando poluição visual imediata no celular.',
      'Busca Retrátil: para clientes com 5 ou mais lançamentos, a ferramenta fica recolhida em um botão discreto "[🔍 Buscar]" no cabeçalho da lista, abrindo apenas quando acionada.'
    ]
  },
  {
    versao: 'v1.3.11',
    data: '09/11/2026',
    titulo: 'Formulários Retráteis e Autocomplete Condicional no Perfil do Cliente',
    destaque: true,
    alterado: [
      'Os formulários de "Lançar Produto" e "Lançar Pagamento" agora iniciam recolhidos em sanfona retrátil (com botão elegante "➕ Abrir"), permitindo visualizar o histórico de compras e pagamentos imediatamente ao abrir a aba no celular.',
      'Autocomplete de produtos aprimorado: as sugestões de produtos mais usados não se abrem mais sozinhas ao focar no campo vazio, surgindo apenas conforme a consultora digita as letras do produto/serviço.',
      'Altura da lista de sugestões otimizada para dispositivos móveis, evitando que ocupe a tela inteira.'
    ]
  },
  {
    versao: 'v1.3.10',
    data: '09/11/2026',
    titulo: 'Perfil do Cliente: Cronograma como 3ª Aba Dedicada com Subtítulos Informativos (Opção B)',
    destaque: true,
    alterado: [
      'O Cronograma de Acertos foi migrado do card superior para uma 3ª aba dedicada no perfil do cliente (🛍️ Produtos | 💵 Pagamentos | 🗓️ Cronograma), deixando o card de saldo limpo e compacto.',
      'Os botões de cada aba agora quebram linha e exibem subtítulos informativos em tamanho pequeno: quantidade de lançamentos e valor total correspondente.',
      'Na aba Cronograma, o subtítulo informa a quantidade de parcelas pendentes e o valor agendado a receber.'
    ]
  },
  {
    versao: 'v1.3.9',
    data: '09/11/2026',
    titulo: 'Perfil do Cliente: Cronograma de Acertos em Sanfona Retrátil (Opção A)',
    destaque: true,
    alterado: [
      'O Cronograma de Acertos agora fica recolhido em sanfona retrátil por padrão no perfil do cliente, liberando espaço visual imediato na tela.',
      'O cabeçalho do acordeão exibe um resumo compacto com quantidade e valor total de parcelas pendentes (ex: 3 pendentes R$ 150,00).',
      'Ao tocar no cabeçalho, as opções de parcelamento, quitação e ações das parcelas expandem suavemente.'
    ]
  },
  {
    versao: 'v1.3.8',
    data: '09/11/2026',
    titulo: 'Barra Visual de Pagamentos, Atalho de Cobrança e Ranking Top Clientes',
    destaque: true,
    adicionado: [
      'Barra visual de porcentagem empilhada e colorida das formas de pagamento (PIX, Dinheiro, Cartão e Outros) no Resumo Financeiro.',
      'Atalho com 1 toque no card "A Receber": abre a aba Clientes já com o filtro de clientes inadimplentes (+30 dias) ativado para cobrança rápida.',
      'Nova seção "Top Clientes do Período": ranking das clientes que mais compraram no mês com botão direto para envio de agradecimento VIP no WhatsApp.'
    ]
  },
  {
    versao: 'v1.3.7',
    data: '09/11/2026',
    titulo: 'Centralização da Exportação de Planilha no Resumo Financeiro',
    destaque: true,
    alterado: [
      'Removido o card redundante de "Backup Completo dos Dados" da aba Equipe & Permissões.',
      'A exportação completa da planilha (Excel/CSV) com todos os clientes, saldos e históricos agora fica centralizada exclusivamente na aba Resumo Financeiro pelo botão "Exportar Planilha".'
    ]
  },
  {
    versao: 'v1.3.6',
    data: '09/11/2026',
    titulo: 'Animação Suave Focada na Borda dos Cards de Clientes',
    destaque: true,
    alterado: [
      'Ajustado o efeito de piscar/pulsar dos cards com acertos para a data de hoje ou vencidos: agora a animação atua exclusivamente no contorno (borda) e no brilho externo.',
      'O fundo do card permanece estável e agradável aos olhos, eliminando o piscar branco em toda a área do card.',
      'Suporte completo e balanceado ao tema claro e modo escuro.'
    ]
  },
  {
    versao: 'v1.3.5',
    data: '09/11/2026',
    titulo: 'Efeito Pulsante/Piscante em Cards com Acertos Críticos (Hoje e Vencidos)',
    destaque: true,
    adicionado: [
      'Animação de alerta pulsante alternando entre a cor padrão e branco nos cards de clientes com acertos com data vencida (vermelho) ou com data de hoje (âmbar).',
      'Maior visibilidade para cobranças imediatas diretamente na tela principal sem perder a identidade visual do card.'
    ]
  },
  {
    versao: 'v1.3.4',
    data: '08/11/2026',
    titulo: 'Página Clicável de Pagamento PIX com Cópia com 1 Toque e QR Code',
    destaque: true,
    adicionado: [
      'Link direto e clicável nas mensagens do WhatsApp direcionando para a nova página de pagamento PIX.',
      'Nova página exclusiva /pix.html responsiva para celulares: exibe valor, beneficiário, QR Code e botão gigante de cópia com 1 toque.',
      'Suporte a cópia com 1 clique tanto do código PIX Copia e Cola quanto da chave PIX isolada.'
    ]
  },
  {
    versao: 'v1.3.3',
    data: '08/11/2026',
    titulo: 'Formatação de Bloco Monospaced do PIX Copia e Cola no WhatsApp',
    destaque: true,
    alterado: [
      'Código PIX Copia e Cola formatado em bloco monospaced (```) nas mensagens do WhatsApp, facilitando a cópia com um único toque no celular do cliente.',
      'Instrução clara para a cliente: "toque no bloco abaixo para copiar".',
      'Inclusão do código PIX Copia e Cola no envio do extrato com resumo financeiro no WhatsApp.'
    ]
  },
  {
    versao: 'v1.3.2',
    data: '08/11/2026',
    titulo: 'Resiliência e Persistência da Chave PIX e Cópia Automática',
    destaque: true,
    alterado: [
      'Persistência local segura da chave PIX no dispositivo para evitar perda de dados entre recargas ou falhas de rede.',
      'Forçamento de atualização do perfil antes do disparo de mensagens no WhatsApp, garantindo que o código Copia e Cola e a chave PIX sempre acompanhem o lembrete de cobrança.',
      'Cópia automática do código PIX Copia e Cola para a área de transferência ao abrir o WhatsApp.'
    ]
  },
  {
    versao: 'v1.3.1',
    data: '08/11/2026',
    titulo: 'Correção e Compatibilidade Total do PIX Copia e Cola para Chave Celular',
    destaque: true,
    alterado: [
      'Normalização automática de chaves PIX de telefone celular para o padrão internacional E.164 (+55 DDD número) exigido pelo Banco Central do Brasil (BACEN / DICT).',
      'Compatibilidade total ao colar o código PIX Copia e Cola em qualquer aplicativo bancário (Nubank, Itaú, Bradesco, Santander, Inter, Mercado Pago, etc.), eliminando erro de código inválido.',
      'Suporte inteligente no cadastro de chave PIX aceitando números digitados com ou sem máscara como (11) 99999-9999, 11999999999 ou +5511999999999.',
      'Dicas e orientações no modal de Meu Perfil e Gerenciamento de Equipe.'
    ]
  },
  {
    versao: 'v1.3.0',
    data: '08/11/2026',
    titulo: 'Nova Aba Resumo Financeiro, Cards 100% Clicáveis e Layout Espaçoso',
    destaque: true,
    adicionado: [
      'Aba exclusiva de Resumo Financeiro como primeira opção do menu, com navegação por mês, balanço geral de entradas e saídas e detalhamento por forma de pagamento.',
      'Card do cliente 100% clicável: tocar em qualquer espaço ou texto do card abre diretamente o perfil completo do cliente, sem áreas mortas.',
      'Novo layout espaçoso de 4 linhas no card: Linha 1 com nome e telefone lado a lado; Linha 2 com botões amplos para o polegar (WhatsApp verde 💬, Editar índigo ✏️, Excluir vermelho 🗑️) e badge de status alinhado à direita; Linha 3 com autoria; Linha 4 com resumo de acertos.',
      'Reorganização da barra de navegação: Resumo Financeiro 📊 > Clientes 👥 > Histórico de Alterações 📜 > Equipe & Permissões 👥🔑.'
    ]
  },
  {
    versao: 'v1.2.50',
    data: '08/11/2026',
    titulo: 'Alinhamento de Nome e Telefone na Mesma Linha no Card de Clientes',
    destaque: false,
    alterado: [
      'Nome e telefone exibidos lado a lado na mesma linha no topo do card do cliente.',
      'Melhor aproveitamento do espaço vertical mantendo visual limpo e fluido em celulares.'
    ]
  },
  {
    versao: 'v1.2.49',
    data: '08/11/2026',
    titulo: 'Reorganização Espaçosa dos Cards de Clientes para Mobile',
    destaque: false,
    alterado: [
      'Novo layout em linhas dedicadas nos cards de clientes: Linha 1 com nome, telefone e badge de saldo sem espremer o texto.',
      'Linha 2 com botões de ação amplos (32x32px ideais para o polegar): WhatsApp verde (💬), Editar índigo (✏️) e Excluir vermelho (🗑️).',
      'Linha 3 com autoria (Por XXX e Edit Por XXX) e Linha 4 com as informações de acertos combinados e atrasos.',
      'Retorno do seletor compacto clássico de filtros no topo, eliminando a barra de rolagem lateral.'
    ]
  },
  {
    versao: 'v1.2.48',
    data: '08/11/2026',
    titulo: 'UX Mobile: Atalho Direto de WhatsApp nos Cards',
    destaque: false,
    adicionado: [
      'Atalho direto de WhatsApp (💬) nos cards de clientes na tela inicial: 1 toque para enviar cobrança com PIX Copia e Cola (ou abrir conversa com cliente em dia).',
      'Pílulas de filtros deslizantes (chips horizontais) para alternar rapidamente entre Todos, Vencem Hoje, Devedores, +30d e Em Dia com o polegar.',
      'Contador numérico dinâmico dentro de cada pílula de filtro informando a quantidade exata de clientes em cada situação.',
      'Botão de 1 toque (✕) no campo de busca para limpar rapidamente a pesquisa em celulares.',
      'Lista de clientes visível imediatamente ao abrir o aplicativo, eliminando toques desnecessários.'
    ]
  },
  {
    versao: 'v1.2.47',
    data: '08/11/2026',
    titulo: 'Comprovante de Pagamento Aprimorado no WhatsApp com PIX do Saldo Restante',
    destaque: false,
    adicionado: [
      'Recibo no WhatsApp mais profissional e legível, com separadores limpos e destaque visual para valor recebido, data e forma de pagamento.',
      'Inclusão automática do código PIX Copia e Cola do saldo restante quando a conta ainda não foi quitada, facilitando o próximo acerto.',
      'Mensagem comemorativa automática quando o pagamento quita 100% da conta do cliente.',
      'Opção interativa "Abrir comprovante no WhatsApp ao confirmar" na janela de quitação de parcelas para envio imediato com apenas 1 clique.'
    ]
  },
  {
    versao: 'v1.2.46',
    data: '08/11/2026',
    titulo: 'Lembrete de Parcela no WhatsApp e Gerador de PIX Copia e Cola',
    destaque: false,
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
