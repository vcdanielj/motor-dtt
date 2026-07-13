import type { SchemaMap } from '@/contracts/row'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

// alias fragments (normalized) → internal field. Order = priority; first match wins per header.
const ALIASES: { field: 'rif' | 'segmentoCrudo' | 'estadoCrudo' | 'ciudad'; needles: string[] }[] = [
  { field: 'rif', needles: ['RIF', 'CEDULA', 'DOCUMENTO CLIENTE'] },
  { field: 'segmentoCrudo', needles: ['CANAL', 'TIPO DE CLIENTE', 'TIPO DE NEGOCIO', 'SEGMENTO', 'FORMATO'] },
  { field: 'estadoCrudo', needles: ['ESTADO', 'EDO'] },
  { field: 'ciudad', needles: ['CIUDAD'] },
]

// Whole-word / whole-phrase match: the needle must appear delimited by word
// boundaries in the normalized header, NOT as a loose substring. This prevents
// a short needle like 'EDO' from matching inside "VENDEDOR HEINZ" (real data bug).
const hasWord = (n: string, needle: string) => ` ${n} `.includes(` ${needle} `)

export function detectSchema(headers: string[]): SchemaMap {
  const map: SchemaMap = { rif: null, segmentoCrudo: null, estadoCrudo: null, ciudad: null, passthrough: [], unmapped: [] }
  for (const h of headers) {
    const n = norm(h)
    const hit = ALIASES.find((a) => a.needles.some((needle) => hasWord(n, needle)))
    if (hit && map[hit.field] === null) { map[hit.field] = h; continue }
    // known money/date passthroughs
    if (/(CAJAS|BS|TON|UNIDADES|FECHA|MES|MONTO|VENTA|PRECIO)/.test(n)) { map.passthrough.push(h); continue }
    map.unmapped.push(h)
  }
  return map
}
