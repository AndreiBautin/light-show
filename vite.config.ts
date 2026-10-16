import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Port pinned so start-app.bat, the README and the dev server always agree.
export const PORT = 5317;

/**
 * The production page's Content-Security-Policy. Everything is same-origin:
 * no CDN, no analytics, no inline script. `blob:` media is the audio file a
 * visitor picks, played from an object URL. Dev is left without it because
 * Vite's dev client injects inline script for hot reload.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function securityHeaders(): Plugin {
  return {
    name: 'security-headers',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head' },
    ],
  };
}

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the site under /<repo>/; the deploy workflow sets
  // BASE_PATH. Everything else (manifest, worker, icons) uses relative URLs,
  // so this is the only place the path lives.
  base: loadEnv(mode, '.', '').BASE_PATH ?? '/',
  plugins: [securityHeaders()],
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
