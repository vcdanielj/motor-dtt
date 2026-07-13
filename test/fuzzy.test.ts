import { test, expect } from 'vitest'
import { ratio, tokenSortRatio, bestMatch } from '@/pipeline/fuzzy'

test('ratio: identical strings score 100', () => {
  expect(ratio('MINIMARKET', 'MINIMARKET')).toBe(100)
})

test('ratio: single-char typo scores high (>=90)', () => {
  // MINIMARKET (10 chars) vs MINIMARKOT (1 substitution: E->O) -> distance 1, len 10 -> 90
  expect(ratio('MINIMARKET', 'MINIMARKOT')).toBeGreaterThanOrEqual(90)
})

test('ratio: totally different strings score low (<50)', () => {
  expect(ratio('BODEGA', 'AEROLINEA INTERNACIONAL')).toBeLessThan(50)
})

test('tokenSortRatio: reordered tokens match perfectly', () => {
  expect(tokenSortRatio('CHARCUTERIA Y CARNICERIA', 'CARNICERIA Y CHARCUTERIA')).toBe(100)
})

test('bestMatch: returns the closest candidate from a list', () => {
  const result = bestMatch('MINIMARKET', ['BODEGA', 'MINIMARKET', 'FARMACIA'])
  expect(result).not.toBeNull()
  expect(result?.candidate).toBe('MINIMARKET')
  expect(result?.score).toBe(100)
})

test('bestMatch: empty candidates returns null', () => {
  expect(bestMatch('MINIMARKET', [])).toBeNull()
})
