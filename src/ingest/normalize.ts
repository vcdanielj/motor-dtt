export function normalizeText(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')     // strip accents
    .toUpperCase()
    .replace(/[/\-_|]+/g, ' / ')                           // unify separators to " / "
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** RIF/cédula key normalization: uppercase, strip everything non-alphanumeric.
 *  'J-500.522.657' and 'J500522657' both → 'J500522657'. */
export function normalizeRif(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '').trim()
}

/** Robust numeric parser supporting European/Latin American comma decimals ('1.234,56'),
 *  US dot decimals ('1,234.56'), negative numbers, currency symbols, and unit tags ('12.5 TON', 'Bs. 500'). */
export function parseNumeric(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0

  let str = String(val).trim()
  if (str === '') return 0

  // Check for negative in parentheses e.g. '(123.45)'
  let isNegative = false
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true
    str = str.slice(1, -1).trim()
  } else if (str.startsWith('-')) {
    isNegative = true
    str = str.slice(1).trim()
  }

  // Strip currency / unit / alphabetic characters except digits, dots, commas, e/E (scientific notation)
  str = str.replace(/[^0-9.,eE]/g, '').trim()
  if (str === '') return 0

  const hasComma = str.includes(',')
  const hasDot = str.includes('.')

  let cleanStr = str
  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    if (lastComma > lastDot) {
      // European/Latin '1.234,56': remove dots, replace comma with dot
      cleanStr = str.replace(/\./g, '').replace(',', '.')
    } else {
      // US '1,234.56': remove commas
      cleanStr = str.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    // Only comma e.g. '12,50' or '1250,5' or '1,000'
    const parts = str.split(',')
    if (parts.length === 2 && parts[1].length <= 2) {
      // Standard 1 or 2 decimal digits: '12,5' -> '12.5'
      cleanStr = str.replace(',', '.')
    } else if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 4) {
      // Thousands separator: '1234,567' -> '1234567'
      cleanStr = str.replace(',', '')
    } else {
      // General case with single comma: treat as decimal
      cleanStr = str.replace(',', '.')
    }
  }

  const n = Number(cleanStr)
  if (!Number.isFinite(n)) return 0
  return isNegative ? -n : n
}

/** Checks if a row is a summary / total footer row (e.g. 'TOTAL', 'TOTAL GENERAL', 'SUMA', etc.)
 *  or empty row that should not be treated as a transaction. */
export function isSummaryFooterRow(rec: Record<string, string>, rifCol: string | null): boolean {
  if (rifCol && rec[rifCol]) {
    const norm = normalizeText(rec[rifCol])
    if (/^(TOTAL|TOTALES|TOTAL GENERAL|SUMA|SUMATORIA|SUBTOTAL|RESUMEN|PROMEDIO)/.test(norm)) {
      return true
    }
  }

  // Check all values in the record
  const values = Object.values(rec).map((v) => String(v ?? '').trim()).filter(Boolean)
  if (values.length === 0) return true

  // If first non-empty value is explicitly 'TOTAL' / 'TOTAL GENERAL' and no valid RIF
  const firstVal = normalizeText(values[0])
  if (/^(TOTAL|TOTALES|TOTAL GENERAL|SUMA|SUMATORIA|SUBTOTAL|GRAND TOTAL)$/.test(firstVal)) {
    return true
  }

  return false
}
