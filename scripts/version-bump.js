/**
 * Script de versionamento de build do NatFlow.
 *
 * Formato da versão: 1.X.X
 *   - grande (minor): incrementa o primeiro X (1.1.0 → 1.2.0) e zera o patch.
 *   - pequena (patch): incrementa o segundo X (1.2.0 → 1.2.1).
 *   - build: se acabou de receber um version:grande (patch 0 e sem build gerado),
 *     mantém a versão grande; caso contrário, incrementa pequena automaticamente.
 *
 * Atualiza package.json antes do build. A versão é injetada dinamicamente
 * pelo vite.config.ts via __BUILD_VERSION__ e publicada em version.json.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
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

  // Em ambientes de CI / Vercel, preserva estritamente a versão commitada no repositório
  // para evitar o "double-bump" (incremento duplo entre máquina local e servidor).
  if (process.env.VERCEL || process.env.CI || process.env.CF_PAGES || process.env.NETLIFY) {
    console.log(`[NatFlow] Ambiente de deploy/CI detectado (${process.env.VERCEL ? 'Vercel' : 'CI'}). Mantendo versão ${pkg.version}`)
    return
  }

  let proximo
  if (tipo === 'grande' || tipo === 'major') {
    proximo = { major, minor: minor + 1, patch: 0 }
  } else if (tipo === 'build' || tipo === 'auto') {
    // Em build, preserva a versão atual configurada no package.json
    console.log(`[NatFlow] Versão mantida para build: ${pkg.version}`)
    return
  } else {
    // pequena / patch
    proximo = { major, minor, patch: patch + 1 }
  }

  const novaVersao = formatVersion(proximo)
  pkg.version = novaVersao
  await writeFile(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')

  console.log(`[NatFlow] Versão atualizada: ${novaVersao}`)
}

const tipo = process.argv[2] || 'pequena'
if (!['grande', 'major', 'pequena', 'minor', 'patch', 'build', 'auto'].includes(tipo)) {
  console.error('Uso: node scripts/version-bump.js <pequena|grande|build>')
  process.exit(1)
}

bump(tipo).catch((err) => {
  console.error(err)
  process.exit(1)
})
