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

  it('returns null for unknown codes', () => {
    const index = buildAliasIndex(sampleAliases)
    expect(resolveAlias('ALIMENTOS CAMPESINO', 'UNKNOWN-123', index)).toBeNull()
  })

  it('a globally-unique distinctive code resolves even when the distributor name differs', () => {
    // The alias table says "ALIMENTOS CAMPESINO"; the file's column says "CAMPESINO C.A." — the
    // exact tier misses, but 'BAR-00236' exists once in the whole base, so it still homologates.
    const index = buildAliasIndex(sampleAliases)
    const match = resolveAlias('CAMPESINO C.A.', 'BAR-00236', index)
    expect(match?.rifCanonico).toBe('J402116012')
  })

  it('a code shared by two distributors with different RIFs is ambiguous — no code-only match', () => {
    const index = buildAliasIndex([
      { distribuidor: 'DIST A', codigoCliente: 'CLI-100', rifCanonico: 'J-111', activa: true },
      { distribuidor: 'DIST B', codigoCliente: 'CLI-100', rifCanonico: 'J-222', activa: true },
    ])
    // Exact tier still works per distributor…
    expect(resolveAlias('DIST A', 'CLI-100', index)?.rifCanonico).toBe('J111')
    expect(resolveAlias('DIST B', 'CLI-100', index)?.rifCanonico).toBe('J222')
    // …but an unknown distributor cannot borrow the code.
    expect(resolveAlias('DIST C', 'CLI-100', index)).toBeNull()
  })

  it('short or purely numeric codes never enter the code-only tier', () => {
    const index = buildAliasIndex([
      { distribuidor: 'DIST A', codigoCliente: '00236', rifCanonico: 'J-111', activa: true },
      { distribuidor: 'DIST B', codigoCliente: 'AB1', rifCanonico: 'J-222', activa: true },
    ])
    expect(resolveAlias('OTRO DIST', '00236', index)).toBeNull()
    expect(resolveAlias('OTRO DIST', 'AB1', index)).toBeNull()
    // The exact tier is unaffected.
    expect(resolveAlias('DIST A', '00236', index)?.rifCanonico).toBe('J111')
  })
})
