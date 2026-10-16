import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Port pinned so start-app.bat, the README and the dev server always agree.
export const PORT = 5317;

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the site under /<repo>/; the deploy workflow sets
  // BASE_PATH. Everything else (manifest, worker, icons) uses relative URLs,
  // so this is the only place the path lives.
  base: loadEnv(mode, '.', '').BASE_PATH ?? '/',
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
