import { describe, expect, test } from 'vitest'
import { pwaManifest } from '@/pwa/manifest'

describe('pwaManifest', () => {
  test('identifies the app with the correct name and short_name', () => {
    expect(pwaManifest.name).toBe('Motor DTT · Estandarización')
    expect(pwaManifest.short_name).toBe('Motor DTT')
  })

  test('uses the brand navy theme color', () => {
    expect(pwaManifest.theme_color).toBe('#0F2B5B')
  })

  test('uses the brand background color', () => {
    expect(pwaManifest.background_color).toBe('#F4F7FB')
  })

  test('installs as a standalone app from the root', () => {
    expect(pwaManifest.display).toBe('standalone')
    expect(pwaManifest.start_url).toBe('/')
  })

  test('declares at least one icon usable for install + maskable purposes', () => {
    expect(pwaManifest.icons.length).toBeGreaterThanOrEqual(1)
    const [icon] = pwaManifest.icons
    expect(icon.src).toBe('/icons/icon.svg')
    expect(icon.type).toBe('image/svg+xml')
    expect(icon.purpose).toContain('maskable')
  })
})
