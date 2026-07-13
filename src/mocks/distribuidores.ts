export interface DistribuidorRow {
  id: string
  nombre: string
  scdcCrudo: number
  scdcPost: number
  registros: number
  ton: number
}

export const MOCK_DISTRIBUIDORES: DistribuidorRow[] = [
  { id: 'd0', nombre: 'EXCELSIOR RK', scdcCrudo: 31, scdcPost: 74, registros: 52014, ton: 418.2 },
  { id: 'd1', nombre: 'ALIMENTOS GLOBAL', scdcCrudo: 38, scdcPost: 79, registros: 22310, ton: 201.7 },
  { id: 'd2', nombre: 'COMERCIALIZADORA 3B GROUP', scdcCrudo: 44, scdcPost: 81, registros: 11842, ton: 96.4 },
  { id: 'd3', nombre: 'MAYORISTA EXITOSO', scdcCrudo: 55, scdcPost: 88, registros: 8905, ton: 71.0 },
]
