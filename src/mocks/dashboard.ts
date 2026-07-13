// Headline KPIs shown on the dashboard view. Sourced from the prototype's summary
// cards (post-corrida placeholder run over the reference dataset).
export interface DashboardKpis {
  totalFilas: string
  estadoValido: string
  coberturaN3: string
  clasificacionN3: string
}

export const MOCK_DASHBOARD: DashboardKpis = {
  totalFilas: '740.009',
  estadoValido: '98,1%',
  coberturaN3: '71,2%',
  clasificacionN3: '92,4%',
}
