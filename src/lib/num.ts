// Numeric helpers shared by the pipeline, the worker and the reports. Previously duplicated
// (verbatim) in metrics.ts, cola.ts and ingest.worker.ts.

/** Percentage with one decimal, 0 when the denominator is 0 (never NaN/Infinity). */
export function pct1(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

/** Upper bound of what a single sell-out row can plausibly weigh. The largest genuine value seen
 *  across the 740K-row historical file is 3.600 TON; anything beyond this bound is a corrupted
 *  cell (an ID, a phone number, a broken formula serialized as '-3.69E+17') leaking into the TON
 *  column — exactly what produced the '-369.070.947.241.054.500 TON' dashboard reading. */
export const MAX_ABS_TON = 100_000

/** Coerces a non-finite TON (NaN from an unparseable cell, ±Infinity) or an implausibly large
 *  magnitude (|ton| > MAX_ABS_TON) to 0 so a single bad row can never poison a running total. */
export function guardTon(ton: number): number {
  if (!Number.isFinite(ton)) return 0
  return Math.abs(ton) > MAX_ABS_TON ? 0 : ton
}
