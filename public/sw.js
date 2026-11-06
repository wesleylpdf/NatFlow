const CACHE_NAME = 'natflow-__BUILD_VERSION__'
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/logo-natflow.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Instalação do Service Worker e pré-cache inicial
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {})
  )
})

// Ativação: assume controle imediato e limpa versões antigas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('natflow-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
    ])
  )
})

// Interceptação segura de requisições: SEMPRE tenta rede primeiro
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // NUNCA intercepta APIs externas (ex: Supabase) nem version.json
  if (url.origin !== self.location.origin || url.pathname.endsWith('/version.json')) {
    return
  }

  // Network-First para todas as requisições locais:
  // Se online, pega sempre o código novo diretamente da Vercel.
  // Se offline, usa o cache local de contingência.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          if (event.request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })
      })
  )
})
