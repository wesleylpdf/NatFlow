/**
 * Classes Tailwind reutilizadas pelos componentes (mantém o visual consistente).
 */
export const cls = {
  card: 'bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm',
  input:
    'border border-slate-200 px-3.5 py-2.5 rounded-xl w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none',
  label: 'block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1',
  btnPrimario:
    'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl font-extrabold text-sm transition shadow-md shadow-emerald-600/20',
  btnSecundario:
    'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition',
  btnPerigo:
    'bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl font-extrabold text-sm transition shadow-md shadow-rose-600/20',
  btnIcone:
    'p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition text-sm leading-none',
}

/** HTML de carregamento (skeleton). */
export function loadingHTML(linhas = 3): string {
  return `
    <div class="max-w-3xl mx-auto space-y-3">
      ${Array.from({ length: linhas }, () => '<div class="skeleton h-20 rounded-3xl"></div>').join('')}
    </div>
  `
}

/** HTML de erro com botão para tentar novamente. */
export function erroHTML(mensagem: string): string {
  return `
    <div class="max-w-3xl mx-auto ${cls.card} p-6 text-center">
      <p class="text-3xl mb-2">⚠️</p>
      <p class="font-bold text-rose-600 dark:text-rose-400 mb-4">${mensagem}</p>
      <button data-acao="recarregar" class="${cls.btnSecundario}" onclick="location.reload()">Tentar novamente</button>
    </div>
  `
}
