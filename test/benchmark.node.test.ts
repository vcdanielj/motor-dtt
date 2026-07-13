// @vitest-environment node
//
// Real-data benchmark harness — runs the pure resolution engine over the actual
// Sell_out CSV (740K rows, ~320MB) in Node, headlessly. GATED behind RUN_BENCH so
// CI / the normal suite never touches the (gitignored) data file.
//
//   RUN_BENCH=1 BENCH_CSV="Sell out OCT-25 MAR-26 2-Sheet2.csv" npx vitest run benchmark.node
//
// This is a validation/reporting tool, not a unit test. It shares the SAME pure
// pipeline modules the browser Web Worker will use, so a green run here is real
// evidence the engine works on production data.
import { createReadStream, existsSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import Papa from 'papaparse'
import { SEEDS } from '@/seeds'
import { detectSchema } from '@/ingest/schema-detect'
import { normalizeText } from '@/ingest/normalize'
import { buildIndex, resolveSegmento, type SegmentoContext, type SegmentoResult } from '@/pipeline/segmento'
import { buildEstadoContext, resolveEstado } from '@/pipeline/estado'
import type { ResolvedRow } from '@/pipeline/process-row'
import type { FlagRegistro, SchemaMap } from '@/contracts/row'
import { MetricsAccumulator, scdcCrudoPct, scdcPostPct } from '@/pipeline/metrics'

const RUN = !!process.env.RUN_BENCH
const CSV = process.env.BENCH_CSV || 'Sell out OCT-25 MAR-26 2-Sheet2.csv'

// The real Sell_out file uses ENGLISH numeric format: dot = decimal (e.g. "0.008928"),
// comma = thousands separator. Strip commas, keep the dot.
const num = (s: string | undefined) => {
  if (!s) return 0
  const n = Number(String(s).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10)

describe.skipIf(!RUN)('benchmark: real Sell_out CSV through the resolution engine', () => {
  it(
    'streams the full file and reports real classification rates',
    async () => {
      expect(existsSync(CSV), `CSV not found: ${CSV}`).toBe(true)

      const seg: SegmentoContext = {
        index: buildIndex(SEEDS.diccionario),
        maestro: new Map(), // pass 1: no maestro yet (measures dictionary + fuzzy only)
        fuzzyThreshold: 92,
        fuzzySuggestFloor: 80,
      }
      const est = buildEstadoContext(SEEDS.estados, SEEDS.ciudadEstado)

      const metrics = new MetricsAccumulator()
      let schema: SchemaMap | null = null
      let distCol: string | null = null
      let tonCol: string | null = null
      let rows = 0
      let tonTotal = 0
      let tonSinClasif = 0
      let crudoPresent = 0
      let sugerencias = 0
      const segTally = { MAESTRO: 0, EXACTO: 0, FUZZY: 0, SIN_CLASIFICAR: 0 }
      const estTally = { EXACTO: 0, RIF: 0, CIUDAD: 0, SIN_ESTADO: 0 }
      const unclassified = new Map<string, { n: number; ton: number }>()
      // Cache the segment resolution (the only fuzzy/slow path) by normalized crudo.
      const segCache = new Map<string, SegmentoResult>()
      let schemaDesc = ''

      const pickHeaders = (headers: string[]) => {
        const sm = detectSchema(headers)
        schema = sm
        distCol =
          headers.find((h) => /distribuidor/i.test(h) && !/jde/i.test(h)) ??
          headers.find((h) => /distribuidor/i.test(h)) ??
          null
        tonCol = headers.find((h) => normalizeText(h) === 'TON') ?? null
        schemaDesc = `rif=${sm.rif} · seg=${sm.segmentoCrudo} · estado=${sm.estadoCrudo} · ciudad=${sm.ciudad} · dist=${distCol} · ton=${tonCol}`
      }

      await new Promise<void>((resolve, reject) => {
        Papa.parse<Record<string, string>>(createReadStream(CSV), {
          header: true,
          skipEmptyLines: true,
          step: (res) => {
            const rec = res.data
            if (!schema) pickHeaders(res.meta.fields ?? Object.keys(rec))
            const s = schema!
            const segCrudo = (s.segmentoCrudo ? rec[s.segmentoCrudo] : '') ?? ''
            const estCrudo = (s.estadoCrudo ? rec[s.estadoCrudo] : '') ?? ''
            const rif = (s.rif ? rec[s.rif] : '') ?? ''
            const ciudad = (s.ciudad ? rec[s.ciudad] : '') ?? ''
            const ton = tonCol ? num(rec[tonCol]) : 0
            const distribuidor = (distCol ? rec[distCol] : '')?.trim() || 'SIN_DISTRIBUIDOR'

            const segKey = normalizeText(segCrudo)
            let segR = segCache.get(segKey)
            if (!segR) {
              segR = resolveSegmento({ rif: null, crudo: segCrudo }, seg) // maestro empty → rif irrelevant here
              segCache.set(segKey, segR)
            }
            const estR = resolveEstado({ rif, ciudad, estadoCrudo: estCrudo }, est)
            const flagRegistro: FlagRegistro =
              segR.flag === 'SIN_CLASIFICAR' ? 'SIN_CLASIFICAR' : estR.flag === 'SIN_ESTADO' ? 'SIN_ESTADO' : 'OK'
            const rr: ResolvedRow = {
              segmentoN3: segR.segmentoN3,
              macroN1: segR.macroN1,
              metodoSegmento: segR.metodo,
              confianzaSegmento: segR.confianza,
              estadoStd: estR.estadoStd,
              metodoEstado: estR.metodo,
              flagRegistro,
              sugerenciaSegmento: segR.sugerencia,
              valorOriginalSegmento: segCrudo,
              valorOriginalEstado: estCrudo,
            }

            rows++
            tonTotal += ton
            if (segKey) crudoPresent++
            segTally[(rr.metodoSegmento ?? 'SIN_CLASIFICAR') as keyof typeof segTally]++
            estTally[(rr.metodoEstado ?? 'SIN_ESTADO') as keyof typeof estTally]++
            if (rr.sugerenciaSegmento) sugerencias++
            metrics.add(distribuidor, rr, ton)

            if (rr.flagRegistro === 'SIN_CLASIFICAR') {
              tonSinClasif += ton
              const key = segCrudo.trim() || '(vacío)'
              const cur = unclassified.get(key) ?? { n: 0, ton: 0 }
              cur.n++
              cur.ton += ton
              unclassified.set(key, cur)
            }
          },
          complete: () => resolve(),
          error: (e) => reject(e),
        })
      })

      const dists = metrics.distribuidores()
      const topUnclass = [...unclassified.entries()].sort((a, b) => b[1].ton - a[1].ton).slice(0, 20)

      const report = [
        '',
        '════════════════ MOTOR DTT · BENCHMARK (datos reales) ════════════════',
        `Archivo: ${CSV}`,
        `Esquema: ${schemaDesc}`,
        `Filas: ${rows.toLocaleString('es-VE')}  ·  Distribuidores: ${dists.length}  ·  TON total: ${tonTotal.toLocaleString('es-VE', { maximumFractionDigits: 0 })}  ·  valores-crudo distintos: ${segCache.size}`,
        '',
        '── SEGMENTO (cascada · sin maestro — pass 1) ──',
        `  EXACTO:          ${segTally.EXACTO.toLocaleString('es-VE').padStart(9)}  (${pct(segTally.EXACTO, rows)}%)`,
        `  FUZZY (≥92):     ${segTally.FUZZY.toLocaleString('es-VE').padStart(9)}  (${pct(segTally.FUZZY, rows)}%)`,
        `  MAESTRO:         ${segTally.MAESTRO.toLocaleString('es-VE').padStart(9)}  (${pct(segTally.MAESTRO, rows)}%)  ← 0 esperado (maestro no construido)`,
        `  SIN_CLASIFICAR:  ${segTally.SIN_CLASIFICAR.toLocaleString('es-VE').padStart(9)}  (${pct(segTally.SIN_CLASIFICAR, rows)}%)`,
        `  Sugerencias a cola (80–91): ${sugerencias.toLocaleString('es-VE')}`,
        '',
        `  Clasificación GLOBAL:                 ${pct(rows - segTally.SIN_CLASIFICAR, rows)}%`,
        `  Filas con crudo presente:             ${crudoPresent.toLocaleString('es-VE')} (${pct(crudoPresent, rows)}%)`,
        `  Clasificación entre crudo-presente:   ${pct(rows - segTally.SIN_CLASIFICAR, crudoPresent)}%  ← comparable al ~92% del PRD`,
        `  TON en SIN_CLASIFICAR:                ${tonSinClasif.toLocaleString('es-VE', { maximumFractionDigits: 0 })} (${pct(tonSinClasif, tonTotal)}% del volumen)`,
        '',
        '── ESTADO (cascada · sin recuperación por RIF) ──',
        `  EXACTO (catálogo): ${estTally.EXACTO.toLocaleString('es-VE').padStart(9)}  (${pct(estTally.EXACTO, rows)}%)`,
        `  CIUDAD:            ${estTally.CIUDAD.toLocaleString('es-VE').padStart(9)}  (${pct(estTally.CIUDAD, rows)}%)`,
        `  SIN_ESTADO:        ${estTally.SIN_ESTADO.toLocaleString('es-VE').padStart(9)}  (${pct(estTally.SIN_ESTADO, rows)}%)`,
        `  Estado válido:     ${pct(estTally.EXACTO + estTally.RIF + estTally.CIUDAD, rows)}%`,
        '',
        '── Top 8 distribuidores por volumen (SCDC crudo → post) ──',
        ...dists.slice(0, 8).map(
          (d) =>
            `  ${d.nombre.slice(0, 32).padEnd(33)} reg=${String(d.registros).padStart(6)}  crudo=${String(scdcCrudoPct(d)).padStart(5)}%  post=${String(scdcPostPct(d)).padStart(5)}%`,
        ),
        '',
        '── Top 20 SIN_CLASIFICAR por TON (candidatos de cola / diccionario) ──',
        ...topUnclass.map(
          ([v, x]) => `  ${v.slice(0, 44).padEnd(45)} n=${String(x.n).padStart(6)}  ton=${x.ton.toLocaleString('es-VE', { maximumFractionDigits: 1 })}`,
        ),
        '══════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n')
      // eslint-disable-next-line no-console
      console.log(report)

      expect(rows).toBeGreaterThan(700_000)
      expect(segTally.EXACTO + segTally.FUZZY + segTally.MAESTRO + segTally.SIN_CLASIFICAR).toBe(rows)
      expect(dists.length).toBeGreaterThan(10)
      expect(pct(rows - segTally.SIN_CLASIFICAR, crudoPresent)).toBeGreaterThan(50)
    },
    600_000,
  )
})
