import { test, expect } from 'vitest'
import { OUTPUT_COLUMNS } from '@/contracts/row'
import type { SchemaMap } from '@/contracts/row'

test('output columns match PRD §7.3 exactly', () => {
  expect(OUTPUT_COLUMNS).toEqual([
    'segmento_n3_std', 'macro_canal_n1_std', 'metodo_segmento', 'confianza_segmento',
    'estado_std', 'metodo_estado', 'flag_registro',
    'valor_original_segmento', 'valor_original_estado', 'version_diccionario', 'run_id',
  ])
})

test('SchemaMap shape compiles', () => {
  const m: SchemaMap = { rif: 'RIF', segmentoCrudo: 'CANAL', estadoCrudo: 'EDO', ciudad: null, passthrough: [], unmapped: [] }
  expect(m.rif).toBe('RIF')
})
