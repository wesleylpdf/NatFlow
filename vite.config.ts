import { defineConfig } from 'vite'
import { copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const raizProjeto = dirname(fileURLToPath(import.meta.url))

// Versão semântica (1.X.X) lida do package.json
const pkg = JSON.parse(readFileSync(resolve(raizProjeto, 'package.json'), 'utf-8'))
const BUILD_VERSION = pkg.version

/**
 * Plugin de versionamento:
 * - Injeta __BUILD_VERSION__ e __BUILD_BASE__ no index.html
 * - Gera dist/version.json com { version, builtAt }
 * - Gera dist/index-<versao>.html
 * - Copia _headers para dist/_headers (garante regras no-cache na hospedagem)
 */
function versionamentoPlugin() {
  let baseUrl = '/'

  return {
    name: 'versionamento-deploy',
    apply: 'build' as const,
    configResolved(config: { base: string }) {
      baseUrl = config.base
    },
    transformIndexHtml(html: string) {
      return html
        .replace(/__BUILD_VERSION__/g, BUILD_VERSION)
        .replace(/__BUILD_BASE__/g, baseUrl)
    },
    closeBundle() {
      const distDir = resolve(raizProjeto, 'dist')

      // 1. version.json
      writeFileSync(
        resolve(distDir, 'version.json'),
        JSON.stringify({ version: BUILD_VERSION, builtAt: new Date().toISOString() }, null, 2)
      )

      // 2. index-<versao>.html para contornar cache antigo
      try {
        copyFileSync(resolve(distDir, 'index.html'), resolve(distDir, `index-${BUILD_VERSION}.html`))
      } catch {
        // ignora se ainda não gerou index
      }

      // 3. Garante que os cabeçalhos de no-cache sejam publicados
      try {
        copyFileSync(resolve(raizProjeto, '_headers'), resolve(distDir, '_headers'))
      } catch {
        // opcional
      }
    },
  }
}

export default defineConfig({
  plugins: [versionamentoPlugin()],
  resolve: {
    alias: {
      '@': resolve(raizProjeto, 'src'),
    },
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
