// Numeric helpers shared by the pipeline, the worker and the reports. Previously duplicated
// (verbatim) in metrics.ts, cola.ts and ingest.worker.ts.

/** Percentage with one decimal, 0 when the denominator is 0 (never NaN/Infinity). */
export function pct1(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

/** Coerces a non-finite TON (NaN from an unparseable cell, ±Infinity) to 0 so a single bad row
 *  can never poison a running total. */
export function guardTon(ton: number): number {
  return Number.isFinite(ton) ? ton : 0
}
