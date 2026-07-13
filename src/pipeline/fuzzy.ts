import { distance } from 'fastest-levenshtein'

/** Levenshtein similarity as an integer 0..100. */
export function ratio(a: string, b: string): number {
  if (a === b) return 100
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 100
  return Math.round((1 - distance(a, b) / maxLen) * 100)
}

/** Order-insensitive similarity: sort whitespace tokens then compare. Handles
 *  "CHARCUTERIA Y CARNICERIA" vs "CARNICERIA CHARCUTERIA". */
export function tokenSortRatio(a: string, b: string): number {
  const sort = (s: string) => s.split(/\s+/).filter(Boolean).sort().join(' ')
  return ratio(sort(a), sort(b))
}

/** Highest tokenSortRatio match over candidates; null if candidates empty. */
export function bestMatch(query: string, candidates: string[]): { candidate: string; score: number } | null {
  let best: { candidate: string; score: number } | null = null
  for (const c of candidates) {
    const score = tokenSortRatio(query, c)
    if (!best || score > best.score) best = { candidate: c, score }
  }
  return best
}
