import { defineConfig } from 'vitest/config';

// Port pinned so start-app.bat, the README and the dev server always agree.
export const PORT = 5317;

export default defineConfig({
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
