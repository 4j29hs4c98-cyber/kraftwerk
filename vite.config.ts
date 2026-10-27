/// <reference types="vitest/config" />
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** GitHub Pages liefert für unbekannte Pfade 404.html aus. Als Kopie von index.html startet dort die SPA. */
function spaFallback404(): Plugin {
  let outDir = 'dist'
  return {
    name: 'kraftwerk-spa-404',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

const THEME_COLOR = '#0c0d0f'

export default defineConfig(({ command }) => {
  // Nur der Build läuft unter https://<nutzer>.github.io/kraftwerk/, lokal bleibt die Wurzel.
  const base = command === 'build' ? '/kraftwerk/' : '/'
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Kraftwerk',
          short_name: 'Kraftwerk',
          description: 'Dein persönlicher Trainingsplan, Workout-Log und Ernährungstracker.',
          lang: 'de',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: THEME_COLOR,
          background_color: THEME_COLOR,
          start_url: base,
          scope: base,
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          globIgnores: ['404.html'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Daten und Anmeldung immer frisch vom Server, niemals aus dem Cache.
              urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
      spaFallback404(),
    ],
    server: { port: 5173, strictPort: true },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  }
})
