import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Indica se as variáveis de ambiente do Supabase foram configuradas. */
export const supabaseConfigurado = Boolean(url && key)

// Valores de fallback evitam erro na importação; main.ts mostra um aviso
// amigável quando `supabaseConfigurado` for falso.
export const supabase = createClient(url || 'http://localhost', key || 'chave-ausente')
