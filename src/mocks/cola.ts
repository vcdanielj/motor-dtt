import type { ColaItem } from '@/contracts/cola'

// Representative queue items covering the three ColaTipo values, transcribed from
// the prototype's trzPool / conflict-detection fixtures.
export const MOCK_COLA: ColaItem[] = [
  {
    id: 'c0',
    tipo: 'VARIANTE_NUEVA',
    valorCrudo: 'SUPER. MINIMARTS',
    registrosAfectados: 214,
    tonAfectadas: 12.6,
    sugerenciaFuzzy: { segmentoN3: 'MINI MARKET', score: 87 },
    resolucion: null,
  },
  {
    id: 'c1',
    tipo: 'CONFLICTO_MAYOR',
    valorCrudo: 'ABASTOS / BODEGAS',
    registrosAfectados: 96,
    tonAfectadas: 5.3,
    sugerenciaFuzzy: null,
    resolucion: null,
  },
  {
    id: 'c2',
    tipo: 'ALTO_VOLUMEN_SIN_CLASIFICAR',
    valorCrudo: 'MAYORISTA S/N',
    registrosAfectados: 1840,
    tonAfectadas: 143.9,
    sugerenciaFuzzy: null,
    resolucion: null,
  },
  {
    id: 'c3',
    tipo: 'VARIANTE_NUEVA',
    valorCrudo: 'PANADERIA-PASTELERIA',
    registrosAfectados: 58,
    tonAfectadas: 2.1,
    sugerenciaFuzzy: { segmentoN3: 'PANADERIA', score: 82 },
    resolucion: null,
  },
]
