export interface BrowserCaps { supported: boolean; hasWorker: boolean; hasFsAccess: boolean; warnings: string[] }

export function detectBrowser(ua = navigator.userAgent): BrowserCaps {
  const hasWorker = typeof Worker !== 'undefined'
  const hasFsAccess = typeof (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
  const isFirefox = /firefox/i.test(ua)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
  const warnings: string[] = []
  if (isFirefox || isSafari) warnings.push('Navegador no óptimo: usa Chrome o Edge de escritorio para exportar archivos y máximo rendimiento.')
  if (!hasWorker) warnings.push('Web Workers no disponibles: el procesamiento podría congelar la interfaz.')
  return { supported: hasWorker, hasWorker, hasFsAccess, warnings }
}
