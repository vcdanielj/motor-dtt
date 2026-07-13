export function normalizeText(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')     // strip accents
    .toUpperCase()
    .replace(/[/\-_|]+/g, ' / ')                           // unify separators to " / "
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
}
