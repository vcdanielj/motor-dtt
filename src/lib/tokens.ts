export const tokens = {
  navy: '#0F2B5B', navyDeep: '#0A1F44', red: '#C8102E', redDeep: '#A50D26',
  green: '#1E8E3E', amber: '#E87722', gold: '#F2A900', cyan: '#0097CE',
  ink: '#1B2430', slate: '#5B6B82', slate2: '#8A96A8', line: '#D9DFE9',
  bg: '#F4F7FB', panel: '#FFFFFF',
} as const
export type TokenName = keyof typeof tokens
