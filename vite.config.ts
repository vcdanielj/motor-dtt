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
  build: { target: 'es2022' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
