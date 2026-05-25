import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // GitHub Pages: serve from /training-app/v2/
  base: '/training-app/v2/',
  build: {
    outDir: '../v2-dist',
    emptyOutDir: true,
  },
})
