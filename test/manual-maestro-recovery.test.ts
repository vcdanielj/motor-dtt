import { test, expect, describe } from 'vitest'
import { MaestroBuilder } from '@/pipeline/maestro'
import { resolveSegmento, buildIndex, type SegmentoContext } from '@/pipeline/segmento'
import { normalizeRif } from '@/ingest/normalize'

// Mirrors the worker's wiring (Sprint 2 · C1): a persisted manual maestro classification is
// pre-observed into the MaestroBuilder with a MANUAL metodo + max fechaOrden BEFORE any row from
// the file is streamed, so it wins D3 (MANUAL > más reciente > moda) regardless of what the file
// itself contains, and its RIF recovers via MAESTRO on resolveSegmento's cascade (step 1).
const MANUAL_FECHA_ORDEN = Number.MAX_SAFE_INTEGER
const UTT = 'TRADE TRADICIONAL (UTT)'

describe('manual maestro pre-seed — recovery', () => {
  test('a manual entry pre-observed into a MaestroBuilder wins D3 over a conflicting EXACTO row', () => {
    const builder = new MaestroBuilder()
    // Pre-seed BEFORE streaming, exactly like seedManualMaestro() in the worker.
    builder.observe({
      rif: 'J-1', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'MANUAL', fechaOrden: MANUAL_FECHA_ORDEN, razonSocial: 'Cliente Manual',
    })
    // The file itself resolves this RIF to a DIFFERENT segment via EXACTO, more "recent" in file
    // terms — but manual provenance must still win.
    builder.observe({ rif: 'J-1', segmentoN3: 'ABASTO', macroN1: UTT, metodo: 'EXACTO', fechaOrden: 202603 })

    const { maestro, conflictos } = builder.build()
    expect(conflictos).toEqual([])
    const entry = maestro.get(normalizeRif('J-1'))
    expect(entry?.segmentoN3).toBe('BODEGA')
    expect(entry?.reglaCanonica).toBe('MANUAL')
  })

  test('a RIF known only via a manual classification (never resolved by the file) recovers as MAESTRO', () => {
    const builder = new MaestroBuilder()
    builder.observe({
      rif: 'J-2', segmentoN3: 'BODEGA', macroN1: UTT, metodo: 'MANUAL', fechaOrden: MANUAL_FECHA_ORDEN, razonSocial: 'Cliente Manual',
    })
    const { maestro } = builder.build()

    const ctx: SegmentoContext = {
      index: buildIndex([]), // empty diccionario: no EXACTO/FUZZY hit possible
      maestro,
      fuzzyThreshold: 92,
      fuzzySuggestFloor: 80,
    }

    // A row for this RIF whose crudo is empty/unknown (would be SIN_CLASIFICAR on its own) still
    // resolves as MAESTRO because the maestro lookup by rif happens before EXACTO/FUZZY.
    const result = resolveSegmento({ rif: 'J-2', crudo: 'algo que no está en el diccionario' }, ctx)
    expect(result.metodo).toBe('MAESTRO')
    expect(result.segmentoN3).toBe('BODEGA')
    expect(result.macroN1).toBe(UTT)
    expect(result.flag).toBe('OK')
  })
})
