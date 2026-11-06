---
name: Correção toast de atualização e version bump deploy
description: Correção dos bugs de toast de atualização não aparecendo e versão não incrementando no deploy
type: project
---

## Problema

Usuários não recebiam o toast de notificação de nova versão quando uma atualização era enviada em produção, e o versionamento (`package.json`) não estava sendo incrementado automaticamente após os builds e comandos de versão.

## Causa raiz

1. **Versão estática**: O script `"build"` no [package.json](file:///d:/openclaude/NatFlow/package.json) estava definido como `"tsc && vite build"`, sem invocar o script de versionamento antes da compilação.
2. **Version Grande não commitado**: A chamada anterior `npm run version:grande` não havia sido persistida/commitada no `package.json`, permanecendo em `1.1.0`.
3. **Garantia de cache**: O arquivo `_headers` não estava presente na pasta `public/`, dependendo exclusivamente da cópia via plugin do Vite.

## Ação tomada

- **[package.json](file:///d:/openclaude/NatFlow/package.json)**:
  - Versão atualizada para `1.2.0` (`version:grande`).
  - Script `"build"` atualizado para `"node scripts/version-bump.js build && tsc && vite build"`.
- **[scripts/version-bump.js](file:///d:/openclaude/NatFlow/scripts/version-bump.js)**:
  - Adicionado suporte ao modo `build`/`auto`: preserva a versão grande inicial (`patch === 0`) na primeira compilação após `version:grande` e incrementa a versão pequena (`patch + 1`) nos builds subsequentes.
- **[public/_headers](file:///d:/openclaude/NatFlow/public/_headers)**:
  - Garantida a presença do arquivo com regras `Cache-Control: no-cache` para `/version.json`, `/index.html` e `/sw.js`.
- **[vercel.json](file:///d:/openclaude/NatFlow/vercel.json)**:
  - Regras de cabeçalho `no-cache` para `/version.json`, `/index.html` e `/sw.js` ativas para a distribuição pela Vercel.

## Verificação

- `npm run build` executado com sucesso: gerou `dist/version.json` com versão `1.2.0`, `dist/index-1.2.0.html` e `dist/_headers`.
- `npx vitest run`: 17 testes passaram (100%).
- `npx tsc --noEmit`: zero erros de tipagem.
- Commit e push para o branch `main` disparando deploy na Vercel (`nat-flow-one.vercel.app`).
- Ao carregar ou receber o polling de 30s, os navegadores compararão `1.1.0` com `1.2.0` no `version.json` sem cache e exibirão o toast de atualização.

## Caminho do projeto

`D:\openclaude\NatFlow`
