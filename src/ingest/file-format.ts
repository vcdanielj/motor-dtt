import type { FileKind } from '@/contracts/pipeline'

export function kindOf(name: string): FileKind | null {
  if (/\.csv$/i.test(name)) return 'csv'
  if (/\.xlsx?$/i.test(name)) return 'xlsx'
  return null
}

// XLSX files are ZIP containers (magic bytes 'PK'). A legacy binary .xls (BIFF) or a renamed file
// is not — without this check JSZip failed with a cryptic "end of central directory" error.
export function esZip(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
  return b.length === 2 && b[0] === 0x50 && b[1] === 0x4b
}

export const MSG_XLS_VIEJO =
  'El archivo no es un XLSX válido — probablemente es un .xls antiguo. Ábrelo en Excel y guárdalo como "Libro de Excel (.xlsx)", o expórtalo a CSV, y vuelve a cargarlo.'
