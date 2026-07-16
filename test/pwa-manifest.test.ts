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
    expect(pwaManifest.id).toBe('/')
    expect(pwaManifest.scope).toBe('/')
    expect(pwaManifest.display).toBe('standalone')
    expect(pwaManifest.start_url).toBe('/')
  })

  test('declares installable icons for Android and desktop browsers', () => {
    expect(pwaManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        }),
        expect.objectContaining({
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        }),
      ]),
    )
  })
})
