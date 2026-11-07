import { abrirFormModal, confirmar } from '@/components/Modal'
import { abrirModalMeuPerfil } from '@/components/Header'
import {
  adicionarMembro,
  atualizarMembro,
  listarEquipe,
  obterPerfilAtual,
  removerMembro,
} from '@/services/equipe'
import type { Autorizado, PapelUsuario } from '@/types'
import { escaparHTML, formatarDataHora } from '@/utils/format'
import { toast, mensagemErro } from '@/utils/toast'
import { cls, erroHTML, loadingHTML } from '@/utils/ui'

export async function renderEquipe(container: HTMLElement): Promise<void> {
  container.innerHTML = loadingHTML()

  let equipe: Autorizado[]
  let perfil: Autorizado | null

  try {
    ;[equipe, perfil] = await Promise.all([listarEquipe(), obterPerfilAtual()])
  } catch (e) {
    container.innerHTML = erroHTML(escaparHTML(mensagemErro(e, 'Erro ao carregar equipe')))
    return
  }

  const souAdmin = perfil?.papel === 'admin'

  const recarregar = async (): Promise<void> => {
    try {
      ;[equipe, perfil] = await Promise.all([listarEquipe(), obterPerfilAtual(true)])
      renderLista()
    } catch (e) {
      toast.error(mensagemErro(e, 'Erro ao atualizar equipe'))
    }
  }

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-5">
      <section class="${cls.card} p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 class="font-black text-base text-slate-900 dark:text-white">🛡️ Equipe & Permissões</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cada membro pode cadastrar sua própria chave PIX para envio automático nas cobranças.
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button id="btn-editar-meu-perfil" class="${cls.btnSecundario} text-xs py-2 px-3" title="Editar meu nome e minha chave PIX">
              🔑 Meu PIX
            </button>
            ${
              souAdmin
                ? `<button id="btn-novo-membro" class="${cls.btnPrimario} text-xs py-2 px-3.5 shrink-0">+ Autorizar Membro</button>`
                : ''
            }
          </div>
        </div>

        ${
          !souAdmin
            ? `<div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-300 font-semibold mb-4">
                ℹ️ Você possui perfil de <strong>Membro</strong>. Você pode configurar sua chave PIX no botão acima. Apenas administradores adicionam novos membros.
               </div>`
            : ''
        }

        <ul id="lista-equipe" class="space-y-2 mt-4"></ul>
      </section>
    </div>
  `

  const listaEl = container.querySelector<HTMLElement>('#lista-equipe')!
  const btnNovo = container.querySelector<HTMLButtonElement>('#btn-novo-membro')
  const btnMeuPerfil = container.querySelector<HTMLButtonElement>('#btn-editar-meu-perfil')

  if (btnMeuPerfil) {
    btnMeuPerfil.addEventListener('click', () => {
      abrirModalMeuPerfil(recarregar)
    })
  }

  function renderLista(): void {
    if (equipe.length === 0) {
      listaEl.innerHTML = `<li class="text-center py-6 text-sm text-slate-500">Nenhum membro cadastrado.</li>`
      return
    }

    listaEl.innerHTML = equipe
      .map(m => {
        const ehVoce = m.email.toLowerCase() === perfil?.email.toLowerCase()
        const badgePapel =
          m.papel === 'admin'
            ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black border border-amber-500/30">ADMIN</span>`
            : `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">MEMBRO</span>`

        const badgeStatus = m.ativo
          ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">Ativo</span>`
          : `<span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">Desativado</span>`

        const pixInfo = m.chave_pix
          ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20" title="${m.beneficiario_pix ? `Beneficiário: ${escaparHTML(m.beneficiario_pix)}` : 'Chave PIX'}">
               <span>🔑 PIX:</span>
               <span class="font-mono">${escaparHTML(m.chave_pix)}</span>
               ${m.beneficiario_pix ? `<span class="opacity-80 font-normal">(${escaparHTML(m.beneficiario_pix)})</span>` : ''}
             </span>`
          : `<span class="text-[11px] text-slate-400 dark:text-slate-500 italic">Sem chave PIX</span>`

        const acoesAdmin =
          souAdmin && !ehVoce
            ? `
            <button data-toggle-ativo="${m.id}" class="${cls.btnIcone}" title="${m.ativo ? 'Desativar acesso' : 'Reativar acesso'}">
              ${m.ativo ? '⏸️' : '▶️'}
            </button>
            <button data-editar="${m.id}" class="${cls.btnIcone}" title="Editar membro">✏️</button>
            <button data-excluir="${m.id}" class="${cls.btnIcone}" title="Remover da equipe">🗑️</button>
          `
            : ''

        return `
          <li class="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-sm text-slate-900 dark:text-white truncate">${escaparHTML(m.nome)}</span>
                ${badgePapel}
                ${badgeStatus}
                ${ehVoce ? `<span class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">VOCÊ</span>` : ''}
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">📧 ${escaparHTML(m.email)}</p>
              <div class="mt-1 flex items-center gap-2 flex-wrap">
                ${pixInfo}
                <span class="text-[10px] text-slate-400 dark:text-slate-500">• Cadastrado em ${formatarDataHora(m.created_at)}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${acoesAdmin}
            </div>
          </li>
        `
      })
      .join('')
  }

  if (btnNovo) {
    btnNovo.addEventListener('click', () => {
      abrirFormModal({
        titulo: 'Autorizar novo membro',
        campos: [
          { nome: 'nome', label: 'Nome completo', tipo: 'text', obrigatorio: true },
          { nome: 'email', label: 'E-mail do membro', tipo: 'text', placeholder: 'usuario@exemplo.com', obrigatorio: true },
          {
            nome: 'papel',
            label: 'Papel na equipe',
            tipo: 'select',
            valor: 'membro',
            obrigatorio: true,
            opcoes: [
              { valor: 'membro', label: 'Membro (cadastra clientes e lança produtos)' },
              { valor: 'admin', label: 'Admin (acesso total e gerencia equipe)' },
            ],
          },
          {
            nome: 'chave_pix',
            label: 'Chave PIX (opcional)',
            tipo: 'text',
            placeholder: 'CPF, CNPJ, Celular, E-mail ou Chave Aleatória',
            obrigatorio: false,
          },
          {
            nome: 'beneficiario_pix',
            label: 'Nome do Beneficiário no PIX (opcional)',
            tipo: 'text',
            placeholder: 'Titular da conta ou Nome da Empresa',
            obrigatorio: false,
          },
        ],
        textoConfirmar: 'Autorizar',
        onSalvar: async valores => {
          const email = valores.email.trim().toLowerCase()
          const nome = valores.nome.trim()
          const papel = valores.papel.trim().toLowerCase() as PapelUsuario
          const chave_pix = valores.chave_pix?.trim() || null
          const beneficiario_pix = valores.beneficiario_pix?.trim() || null
          if (papel !== 'admin' && papel !== 'membro') {
            throw new Error('O papel deve ser "admin" ou "membro"')
          }
          await adicionarMembro({ email, nome, papel, chave_pix, beneficiario_pix })
          toast.success(`Membro ${nome} autorizado com sucesso!`)
          await recarregar()
        },
      })
    })
  }

  listaEl.addEventListener('click', async e => {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-editar],[data-excluir],[data-toggle-ativo],[data-meu-perfil]'
    )
    if (!alvo) return
    e.preventDefault()

    if (alvo.dataset.meuPerfil !== undefined) {
      abrirModalMeuPerfil(recarregar)
      return
    }

    const id = alvo.dataset.editar ?? alvo.dataset.excluir ?? alvo.dataset.toggleAtivo!
    const membro = equipe.find(m => m.id === id)
    if (!membro) return

    if (alvo.dataset.toggleAtivo) {
      const novoStatus = !membro.ativo
      try {
        await atualizarMembro(membro.id, { ativo: novoStatus })
        toast.success(novoStatus ? 'Acesso reativado!' : 'Acesso temporariamente suspenso.')
        await recarregar()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao alterar status'))
      }
      return
    }

    if (alvo.dataset.editar) {
      abrirFormModal({
        titulo: `Editar membro: ${membro.nome}`,
        campos: [
          { nome: 'nome', label: 'Nome completo', tipo: 'text', valor: membro.nome, obrigatorio: true },
          {
            nome: 'papel',
            label: 'Papel na equipe',
            tipo: 'select',
            valor: membro.papel,
            obrigatorio: true,
            opcoes: [
              { valor: 'membro', label: 'Membro (cadastra clientes e lança produtos)' },
              { valor: 'admin', label: 'Admin (acesso total e gerencia equipe)' },
            ],
          },
          {
            nome: 'chave_pix',
            label: 'Chave PIX',
            tipo: 'text',
            valor: membro.chave_pix || '',
            placeholder: 'CPF, CNPJ, Celular, E-mail ou Chave Aleatória',
            obrigatorio: false,
          },
          {
            nome: 'beneficiario_pix',
            label: 'Nome do Beneficiário no PIX (opcional)',
            tipo: 'text',
            valor: membro.beneficiario_pix || '',
            placeholder: 'Titular da conta ou Nome da Empresa',
            obrigatorio: false,
          },
        ],
        onSalvar: async valores => {
          const papel = valores.papel.trim().toLowerCase() as PapelUsuario
          if (papel !== 'admin' && papel !== 'membro') {
            throw new Error('O papel deve ser "admin" ou "membro"')
          }
          await atualizarMembro(membro.id, {
            nome: valores.nome.trim(),
            papel,
            chave_pix: valores.chave_pix?.trim() || null,
            beneficiario_pix: valores.beneficiario_pix?.trim() || null,
          })
          toast.success('Membro atualizado com sucesso!')
          await recarregar()
        },
      })
      return
    }

    if (alvo.dataset.excluir) {
      const ok = await confirmar({
        titulo: 'Revogar autorização',
        mensagem: `Tem certeza que deseja remover <strong>${escaparHTML(membro.nome)}</strong> (${escaparHTML(membro.email)}) da equipe? O usuário não conseguirá mais acessar o NatFlow.`,
        textoConfirmar: 'Remover',
      })
      if (!ok) return
      try {
        await removerMembro(membro.id)
        toast.success('Autorização revogada.')
        await recarregar()
      } catch (err) {
        toast.error(mensagemErro(err, 'Erro ao revogar autorização'))
      }
    }
  })

  renderLista()
}
