import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [
    svelte({ hot: false }),
    svelteTesting(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    reporters: ['verbose'],
    setupFiles: ['./src/tests/setup.ts'],
  },
});
