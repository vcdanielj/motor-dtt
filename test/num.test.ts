import { test, expect, describe } from 'vitest'
import { guardTon, pct1, MAX_ABS_TON } from '@/lib/num'

describe('guardTon — plausibility clamp', () => {
  test('passes normal values through, including legitimate negatives (devoluciones)', () => {
    expect(guardTon(0.008928)).toBe(0.008928)
    expect(guardTon(-0.38112)).toBe(-0.38112)
    expect(guardTon(3600)).toBe(3600)
  })

  test('coerces NaN and ±Infinity to 0', () => {
    expect(guardTon(NaN)).toBe(0)
    expect(guardTon(Infinity)).toBe(0)
    expect(guardTon(-Infinity)).toBe(0)
  })

  test('zeroes the corrupted-cell magnitudes that produced the -369.070.947.241.054.500 TON dashboard', () => {
    expect(guardTon(-3.690709472410545e17)).toBe(0)
    expect(guardTon(3.690709472410545e17)).toBe(0)
    expect(guardTon(MAX_ABS_TON + 1)).toBe(0)
    expect(guardTon(MAX_ABS_TON)).toBe(MAX_ABS_TON)
    expect(guardTon(-MAX_ABS_TON)).toBe(-MAX_ABS_TON)
  })
})

describe('pct1', () => {
  test('never divides by zero', () => {
    expect(pct1(5, 0)).toBe(0)
  })
  test('one-decimal rounding', () => {
    expect(pct1(1, 3)).toBe(33.3)
  })
})
