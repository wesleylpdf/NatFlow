import { supabase } from '@/lib/supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

type AuthCallback = (state: AuthState) => void

let currentState: AuthState = {
  user: null,
  session: null,
  loading: true,
}

let listeners: AuthCallback[] = []

/**
 * Inicializa auth e escuta mudanças de estado
 */
export function initAuth(): () => void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentState = { user: session?.user ?? null, session, loading: false }
    notifyListeners()
  })

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    currentState = { user: session?.user ?? null, session, loading: false }
    notifyListeners()
  })

  return () => subscription.unsubscribe()
}

/**
 * Registra callback para mudanças de auth
 */
export function onAuthChange(callback: AuthCallback): () => void {
  listeners.push(callback)
  return () => {
    listeners = listeners.filter(l => l !== callback)
  }
}

export function getAuthState(): AuthState {
  return currentState
}

function notifyListeners(): void {
  listeners.forEach(l => l(currentState))
}

function urlRetorno(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

/**
 * Login com email e senha
 */
export async function login(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/**
 * Cadastro com email e senha (conta do dono do negócio, não dos clientes)
 */
export async function cadastro(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: urlRetorno() },
  })
  if (error) throw error
}

/**
 * Envia email de reset de senha
 */
export async function resetSenha(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlRetorno() })
  if (error) throw error
}

/**
 * Define nova senha (após abrir o link de recuperação)
 */
export async function atualizarSenha(novaSenha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: novaSenha })
  if (error) throw error
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
