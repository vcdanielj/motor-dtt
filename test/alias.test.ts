import { describe, it, expect } from 'vitest'
import { buildAliasIndex, resolveAlias } from '@/pipeline/alias'
import type { ClienteAliasEntry } from '@/contracts/config'

describe('Alias & Client Code Homologation', () => {
  const sampleAliases: ClienteAliasEntry[] = [
    {
      distribuidor: 'ALIMENTOS CAMPESINO',
      codigoCliente: 'BAR-00236',
      rifCanonico: 'J-402116012',
      razonSocial: 'EMBUTIDOS CASA ITALIA C.A.',
      estadoStd: 'BARINAS',
      activa: true,
    },
    {
      distribuidor: 'SUPLIMOS',
      codigoCliente: 'CLI-9901',
      rifCanonico: 'J-000312456',
      razonSocial: 'AUTOMERCADOS PLAZA',
      activa: true,
    },
    {
      distribuidor: 'DISTRIBUIDOR INACTIVO',
      codigoCliente: 'OLD-001',
      rifCanonico: 'J-111111111',
      activa: false,
    },
  ]

  it('builds an index and resolves active distributor client codes to canonical RIFs', () => {
    const index = buildAliasIndex(sampleAliases)
    const match = resolveAlias('Alimentos Campesino', 'bar-00236', index)
    expect(match).not.toBeNull()
    expect(match?.rifCanonico).toBe('J402116012')
    expect(match?.razonSocial).toBe('EMBUTIDOS CASA ITALIA C.A.')
  })

  it('ignores inactive aliases', () => {
    const index = buildAliasIndex(sampleAliases)
    const match = resolveAlias('DISTRIBUIDOR INACTIVO', 'OLD-001', index)
    expect(match).toBeNull()
  })

  it('returns null for unknown codes or distributors', () => {
    const index = buildAliasIndex(sampleAliases)
    expect(resolveAlias('OTRO_DIST', 'BAR-00236', index)).toBeNull()
    expect(resolveAlias('ALIMENTOS CAMPESINO', 'UNKNOWN-123', index)).toBeNull()
  })
})
