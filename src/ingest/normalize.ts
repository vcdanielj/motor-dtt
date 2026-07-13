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
export function normalizeRif(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '')
}
