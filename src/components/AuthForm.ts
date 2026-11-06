import { login, cadastro, resetSenha } from '@/hooks/useAuth'
import { mensagemErro } from '@/utils/toast'

type Modo = 'login' | 'cadastro' | 'reset'

function traduzirErro(msg: string): string {
  if (
    msg.includes('EMAIL_NAO_AUTORIZADO') ||
    msg.includes('Database error saving new user') ||
    msg.includes('Database error')
  ) {
    return 'Este e-mail não foi autorizado pelo administrador'
  }
  if (msg.includes('Invalid login credentials') || msg.includes('Invalid email or password'))
    return 'E-mail ou senha incorretos'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar'
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado'
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres'
  if (msg.includes('Invalid email') || msg.includes('invalid format')) return 'E-mail inválido'
  return msg || 'Erro na autenticação'
}

export function criarAuthForm(container: HTMLElement): void {
  container.innerHTML = `
    <div id="auth-screen" class="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center z-[999] p-4 overflow-y-auto min-h-screen">
      <form id="auth-form" novalidate class="relative bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 rounded-3xl text-center w-full max-w-sm mx-auto shadow-2xl my-auto">
        <img src="/logo-natflow.svg" alt="NatFlow" class="mx-auto mb-3 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-lg shadow-emerald-500/30 object-contain">
        <h2 class="font-black text-2xl mb-1 text-slate-900 dark:text-white tracking-tight">NatFlow</h2>
        <p id="auth-subtitle" class="text-sm text-slate-500 mb-3 dark:text-slate-400">Entre na sua conta</p>
        <div class="inline-block mb-4 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Versão: ${__BUILD_VERSION__}</div>

        <div class="space-y-3 mb-4 text-left">
          <input type="email" id="auth-email" class="border border-slate-200 p-3.5 rounded-2xl w-full bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Seu e-mail" autocomplete="email">
          <input type="password" id="auth-pass" class="border border-slate-200 p-3.5 rounded-2xl w-full bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Sua senha" autocomplete="current-password">
        </div>

        <p id="auth-msg" class="text-rose-500 text-xs font-semibold mb-3 hidden"></p>

        <button id="auth-submit" type="submit" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-8 py-3.5 rounded-2xl font-extrabold w-full transition shadow-lg shadow-emerald-600/25 text-base">Entrar</button>

        <div class="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-sm">
          <a id="auth-toggle" href="#" class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline block">Não tem conta? Cadastre-se</a>
          <a id="auth-reset" href="#" class="text-slate-400 hover:underline block text-xs">Esqueci minha senha</a>
        </div>
      </form>
    </div>
  `

  let modo: Modo = 'login'
  const form = container.querySelector<HTMLFormElement>('#auth-form')!
  const submitBtn = container.querySelector<HTMLButtonElement>('#auth-submit')!
  const toggleLink = container.querySelector<HTMLElement>('#auth-toggle')!
  const resetLink = container.querySelector<HTMLElement>('#auth-reset')!
  const subtitle = container.querySelector<HTMLElement>('#auth-subtitle')!
  const msgEl = container.querySelector<HTMLElement>('#auth-msg')!
  const emailInput = container.querySelector<HTMLInputElement>('#auth-email')!
  const passInput = container.querySelector<HTMLInputElement>('#auth-pass')!

  const textoBotao = (): string =>
    modo === 'login' ? 'Entrar' : modo === 'cadastro' ? 'Cadastrar' : 'Enviar e-mail'

  function mostrarMsg(texto: string, sucesso = false): void {
    msgEl.textContent = texto
    msgEl.classList.remove('hidden', 'text-rose-500', 'text-emerald-500')
    msgEl.classList.add(sucesso ? 'text-emerald-500' : 'text-rose-500')
  }

  function atualizarUI(limparMsg = true): void {
    if (limparMsg) msgEl.classList.add('hidden')
    submitBtn.textContent = textoBotao()
    passInput.classList.toggle('hidden', modo === 'reset')
    resetLink.classList.toggle('hidden', modo !== 'login')
    passInput.autocomplete = modo === 'cadastro' ? 'new-password' : 'current-password'
    if (modo === 'login') {
      subtitle.textContent = 'Entre na sua conta'
      toggleLink.textContent = 'Não tem conta? Cadastre-se'
    } else if (modo === 'cadastro') {
      subtitle.textContent = 'Crie sua conta'
      toggleLink.textContent = 'Já tem conta? Entre'
    } else {
      subtitle.textContent = 'Recupere sua senha'
      toggleLink.textContent = 'Voltar para login'
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const email = emailInput.value.trim()
    const pass = passInput.value

    if (!email || (modo !== 'reset' && !pass)) {
      mostrarMsg(modo === 'reset' ? 'Preencha o e-mail' : 'Preencha todos os campos')
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = 'Carregando...'
    msgEl.classList.add('hidden')

    try {
      if (modo === 'login') {
        await login(email, pass)
      } else if (modo === 'cadastro') {
        await cadastro(email, pass)
        modo = 'login'
        passInput.value = ''
        atualizarUI()
        mostrarMsg('Conta criada! Confirme no e-mail cadastrado.', true)
      } else {
        await resetSenha(email)
        modo = 'login'
        atualizarUI()
        mostrarMsg('E-mail de recuperação enviado! Verifique sua caixa de entrada.', true)
      }
    } catch (err) {
      if (modo === 'login') passInput.value = ''
      mostrarMsg(traduzirErro(mensagemErro(err, '')))
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = textoBotao()
    }
  })

  toggleLink.addEventListener('click', e => {
    e.preventDefault()
    modo = modo === 'login' ? 'cadastro' : 'login'
    atualizarUI()
  })

  resetLink.addEventListener('click', e => {
    e.preventDefault()
    modo = 'reset'
    passInput.value = ''
    atualizarUI()
  })

  atualizarUI()
}
