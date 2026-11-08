import { createClient } from '@supabase/supabase-js'

// Polyfill minimalista para ambientes Node.js sem WebSocket nativo (ex: testes unitários em CI ou Node < 22)
if (typeof globalThis.WebSocket === 'undefined') {
  class MockWebSocket {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    readonly readyState = 3
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  }
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Indica se as variáveis de ambiente do Supabase foram configuradas. */
export const supabaseConfigurado = Boolean(url && key)

// Valores de fallback evitam erro na importação; main.ts mostra um aviso
// amigável quando `supabaseConfigurado` for falso.
export const supabase = createClient(url || 'http://localhost', key || 'chave-ausente')
