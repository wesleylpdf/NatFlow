/**
 * Script de versionamento de build do NatFlow.
 *
 * Formato da versão: 1.X.X
 *   - grande (minor): incrementa o primeiro X (1.0.0 → 1.1.0) e zera o segundo X.
 *   - pequena (patch): incrementa o segundo X (1.0.0 → 1.0.1).
 *
 * Atualiza package.json antes do build. A versão é injetada dinamicamente
 * pelo vite.config.ts via __BUILD_VERSION__ e publicada em version.json.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const PKG_PATH = resolve(ROOT, 'package.json')

function parseVersion(versao) {
  const [major, minor, patch] = String(versao).split('.').map(Number)
  return {
    major: isNaN(major) ? 1 : major,
    minor: isNaN(minor) ? 0 : minor,
    patch: isNaN(patch) ? 0 : patch,
  }
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`
}

export async function bump(tipo) {
  const pkg = JSON.parse(await readFile(PKG_PATH, 'utf-8'))
  const { major, minor, patch } = parseVersion(pkg.version)

  let proximo
  if (tipo === 'grande' || tipo === 'major') {
    proximo = { major, minor: minor + 1, patch: 0 }
  } else {
    // pequena / patch (padrão)
    proximo = { major, minor, patch: patch + 1 }
  }

  const novaVersao = formatVersion(proximo)
  pkg.version = novaVersao
  await writeFile(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')

  console.log(`[NatFlow] Versão atualizada: ${novaVersao}`)
}

const tipo = process.argv[2] || 'pequena'
if (!['grande', 'major', 'pequena', 'minor', 'patch'].includes(tipo)) {
  console.error('Uso: node scripts/version-bump.js <pequena|grande>')
  process.exit(1)
}

bump(tipo).catch((err) => {
  console.error(err)
  process.exit(1)
})
