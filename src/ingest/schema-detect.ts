import type { SchemaMap } from '@/contracts/row'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

// alias fragments (normalized) → internal field. Order = priority; first match wins per header.
const ALIASES: { field: 'rif' | 'segmentoCrudo' | 'estadoCrudo' | 'ciudad'; needles: string[] }[] = [
  { field: 'rif', needles: ['RIF', 'CEDULA', 'NIT', 'DOCUMENTO CLIENTE'] },
  { field: 'segmentoCrudo', needles: ['CANAL', 'SUBCANAL', 'TIPO DE CLIENTE', 'TIPO DE NEGOCIO', 'TIPO DE TIENDA', 'SEGMENTO', 'FORMATO', 'GIRO', 'RUBRO', 'CLASIFICACION'] },
  { field: 'estadoCrudo', needles: ['ESTADO', 'EDO', 'ENTIDAD', 'ENTIDAD FEDERAL', 'REGION'] },
  { field: 'ciudad', needles: ['CIUDAD', 'MUNICIPIO', 'LOCALIDAD', 'POBLACION', 'PARROQUIA'] },
]

// Headers that contain the word ESTADO but mean something entirely different. Without this, an
// "ESTADO DEL PEDIDO" or "ESTADO CIVIL" column gets routed into the state cascade and every row
// resolves SIN_ESTADO — worse, it shadows the real state column, which is then never mapped
// (first match wins per field).
const ESTADO_FALSOS_AMIGOS = [
  'ESTADO DEL PEDIDO', 'ESTADO PEDIDO', 'ESTADO DE PEDIDO',
  'ESTADO CIVIL', 'ESTADO DEL CLIENTE', 'ESTADO CLIENTE',
  'ESTADO DE LA FACTURA', 'ESTADO FACTURA', 'ESTADO DOCUMENTO',
  'ESTADO DE CUENTA', 'ESTADO CUENTA', 'ESTADO REGISTRO', 'ESTATUS',
]

// Whole-word / whole-phrase match: the needle must appear delimited by word
// boundaries in the normalized header, NOT as a loose substring. This prevents
// a short needle like 'EDO' from matching inside "VENDEDOR HEINZ" (real data bug).
const hasWord = (n: string, needle: string) => ` ${n} `.includes(` ${needle} `)

export function detectSchema(headers: string[]): SchemaMap {
  const map: SchemaMap = { rif: null, segmentoCrudo: null, estadoCrudo: null, ciudad: null, passthrough: [], unmapped: [] }
  for (const h of headers) {
    const n = norm(h)
    if (ESTADO_FALSOS_AMIGOS.some((f) => hasWord(n, f))) { map.unmapped.push(h); continue }
    const hit = ALIASES.find((a) => a.needles.some((needle) => hasWord(n, needle)))
    if (hit && map[hit.field] === null) { map[hit.field] = h; continue }
    // known money/date passthroughs
    if (/(CAJAS|BS|TON|UNIDADES|FECHA|MES|MONTO|VENTA|PRECIO)/.test(n)) { map.passthrough.push(h); continue }
    map.unmapped.push(h)
  }
  return map
}
