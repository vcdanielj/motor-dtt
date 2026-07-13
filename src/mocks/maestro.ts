import type { MaestroEntry } from '@/contracts/maestro'

// Representative maestro entries, transcribed from the prototype's buildMaestro
// fixture. N3/macro pairs align with src/seeds/segmentos.ts.
export const MOCK_MAESTRO: MaestroEntry[] = [
  {
    rif: 'J-00123456-7',
    razonSocial: 'BODEGA EL PROGRESO C.A.',
    segmentoN3: 'BODEGA',
    macroN1: 'TRADE TRADICIONAL (UTT)',
    metodo: 'MAESTRO',
    confianza: 'N3',
    estadoHabitual: 'MIRANDA',
    fechaClasificacion: '2026-06-02T00:00:00.000Z',
    reglaCanonica: 'MODA',
  },
  {
    rif: 'J-30987654-1',
    razonSocial: 'AUTOMERCADO LA CENTRAL',
    segmentoN3: 'AUTOMERCADO',
    macroN1: 'SUPERMERCADOS INDEPENDIENTES',
    metodo: 'FUZZY',
    confianza: 'N3',
    estadoHabitual: 'CARABOBO',
    fechaClasificacion: '2026-05-18T00:00:00.000Z',
    reglaCanonica: 'RECIENTE',
  },
  {
    rif: 'V-12345678-9',
    razonSocial: null,
    segmentoN3: 'MAYORISTA CON FUERZA DE VENTA',
    macroN1: 'MAYORISTAS',
    metodo: 'MANUAL',
    confianza: 'MACRO',
    estadoHabitual: 'ZULIA',
    fechaClasificacion: '2026-04-27T00:00:00.000Z',
    reglaCanonica: 'MANUAL',
  },
  {
    rif: 'J-40112233-5',
    razonSocial: 'FARMACIA MODERNA DEL ESTE',
    segmentoN3: null,
    macroN1: null,
    metodo: null,
    confianza: null,
    estadoHabitual: 'ARAGUA',
    fechaClasificacion: null,
    reglaCanonica: null,
  },
]
