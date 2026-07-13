import { test, expect } from 'vitest'
import { normalizeText, normalizeRif } from '@/ingest/normalize'

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

test('normalizeRif: strips separators and dots, uppercases', () => {
  expect(normalizeRif('J-500.522.657')).toBe('J500522657')
  expect(normalizeRif('J500522657')).toBe('J500522657')
  expect(normalizeRif('j-500522657')).toBe('J500522657')
})

test('normalizeRif: two raw formats of the same RIF converge', () => {
  expect(normalizeRif('J-500522657')).toBe(normalizeRif('J500522657'))
})

test('normalizeRif: empty/nullish-safe and idempotent', () => {
  expect(normalizeRif('')).toBe('')
  const once = normalizeRif('J-500.522.657')
  expect(normalizeRif(once)).toBe(once)
})
