// Per-distributor SCDC row shape. Shared by src/mocks/distribuidores.ts (Sprint-1 placeholder
// data) and the real PipelineRunResult (Sprint-2 W1) so the Distribuidores/Dashboard views
// render unchanged regardless of which source populated the store.
export interface DistribuidorRow {
  id: string
  nombre: string
  scdcCrudo: number
  scdcPost: number
  registros: number
  ton: number
}
