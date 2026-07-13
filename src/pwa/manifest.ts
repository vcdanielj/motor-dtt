/**
 * Web App Manifest for Motor DTT.
 *
 * This is the single source of truth for the PWA manifest: it is imported by
 * `vite.config.ts` (passed to `VitePWA({ manifest: pwaManifest })`) and is
 * unit-tested directly in `test/pwa-manifest.test.ts`, so the fields that
 * ship in `dist/manifest.webmanifest` are the same fields under test.
 */

export interface PwaManifestIcon {
  src: string
  sizes: string
  type: string
  purpose?: string
}

export interface PwaManifest {
  name: string
  short_name: string
  description: string
  theme_color: string
  background_color: string
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
  start_url: string
  icons: PwaManifestIcon[]
}

export const pwaManifest: PwaManifest = {
  name: 'Motor DTT · Estandarización',
  short_name: 'Motor DTT',
  description: 'Motor de estandarización de datos DTT — operación local, sin envío de datos.',
  theme_color: '#0F2B5B',
  background_color: '#F4F7FB',
  display: 'standalone',
  start_url: '/',
  icons: [
    {
      src: '/icons/icon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    },
  ],
}
