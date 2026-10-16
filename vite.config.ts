import { loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';
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

const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({
  tag: 'meta',
  attrs,
  injectTo: 'head',
});

/**
 * Production-only head tags: the CSP and referrer policy; the commit the
 * build came from (the deploy smoke test looks for it); and, when the site's
 * absolute URL is known, the share card a link preview reads.
 */
function productionHead(env: Record<string, string>): Plugin {
  return {
    name: 'production-head',
    apply: 'build',
    transformIndexHtml: () => {
      const tags: HtmlTagDescriptor[] = [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
        meta({ name: 'referrer', content: 'no-referrer' }),
      ];
      if (env.VITE_COMMIT) tags.push(meta({ name: 'build-commit', content: env.VITE_COMMIT }));
      const site = env.SITE_URL;
      if (site) {
        const title = 'Light Show';
        const description = 'Classic screensavers, rebuilt in WebGL and played by your music.';
        tags.push(
          meta({ property: 'og:type', content: 'website' }),
          meta({ property: 'og:url', content: site }),
          meta({ property: 'og:title', content: title }),
          meta({ property: 'og:description', content: description }),
          meta({ property: 'og:image', content: `${site}og.jpg` }),
          meta({ property: 'og:image:width', content: '800' }),
          meta({ property: 'og:image:height', content: '450' }),
          meta({ name: 'twitter:card', content: 'summary_large_image' }),
        );
      }
      return tags;
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // GitHub Pages serves the site under /<repo>/; the deploy workflow sets
    // BASE_PATH. Everything else (manifest, worker, icons) uses relative URLs,
    // so this is the only place the path lives.
    base: env.BASE_PATH ?? '/',
    plugins: [productionHead(env)],
    server: { port: PORT, strictPort: true },
    preview: { port: PORT, strictPort: true },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        // The floor applies to the pure modules: where the decisions are, and
        // where a test can say something without a browser. Adapters and
        // shaders are judged by eye (docs/TESTING.md says why).
        include: [
          'src/analysis/**/*.ts',
          'src/render/quality.ts',
          'src/ui/scene-url.ts',
          'src/ui/gesture.ts',
          'src/ui/file-check.ts',
        ],
        exclude: ['**/*.test.ts'],
        thresholds: { lines: 95, statements: 95, functions: 90, branches: 85 },
      },
    },
  };
});
