import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { pwaManifest } from './src/pwa/manifest'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: pwaManifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // No runtime caching of any data files — RNF5 (privacy).
        runtimeCaching: [],
      },
    }),
  ],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    // Local file: dependencies resolve outside node_modules. Convert their CJS/UMD
    // distributions in both the application and the ingest worker.
    commonjsOptions: { include: [/node_modules/, /vendor\//] },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
