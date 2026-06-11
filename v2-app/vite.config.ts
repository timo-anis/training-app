import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// Build version stamped into the bundle for error attribution (date + git sha).
function appVersion(): string {
  const date = new Date().toISOString().slice(0, 10)
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return sha ? `${date}+${sha}` : date
  } catch {
    return date
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      base: '/',
      manifest: {
        name: 'Timo Training',
        short_name: 'Training',
        description: 'Personal training tracker',
        theme_color: '#08172d',
        background_color: '#08172d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  // Custom domain trainingapp.timoanis.com: served from root
  base: '/',
  build: {
    outDir: '../v2-dist',
    emptyOutDir: true,
  },
})
