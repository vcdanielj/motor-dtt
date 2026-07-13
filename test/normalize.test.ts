import { test, expect } from 'vitest'
import { normalizeText } from '@/ingest/normalize'

test('R1: upper, trim, strip accents, collapse spaces', () => {
  expect(normalizeText('  Bodegón   ')).toBe('BODEGON')
  expect(normalizeText('Panadería/Pastelería')).toBe('PANADERIA / PASTELERIA')
  expect(normalizeText('MINI   MARKET')).toBe('MINI MARKET')
})

test('R1: idempotent', () => {
  const once = normalizeText('Súper-Mercado')
  expect(normalizeText(once)).toBe(once)
})

test('R1: empty/nullish safe', () => {
  expect(normalizeText('')).toBe('')
  expect(normalizeText('   ')).toBe('')
})
