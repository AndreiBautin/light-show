import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig } from './config';

describe('parseConfig', () => {
  it('uses defaults when nothing is set', () => {
    expect(parseConfig({})).toEqual({ config: DEFAULT_CONFIG, warnings: [] });
  });

  it('falls back with a warning on a typo instead of throwing', () => {
    const { config, warnings } = parseConfig({ VITE_LOG_LEVEL: 'verbose' });
    expect(config.logLevel).toBe('info');
    expect(warnings).toHaveLength(1);
  });

  // Silently wrong if broken: a high value would let the show strobe unsafely.
  it('never allows more than 3 flashes per second', () => {
    expect(parseConfig({ VITE_MAX_FLASHES_PER_SECOND: '10' }).config.maxFlashesPerSecond).toBe(3);
    expect(parseConfig({ VITE_MAX_FLASHES_PER_SECOND: '0' }).config.maxFlashesPerSecond).toBe(1);
    expect(parseConfig({ VITE_MAX_FLASHES_PER_SECOND: 'lots' }).config.maxFlashesPerSecond).toBe(3);
  });

  // The worker caches aggressively; registered in dev it would serve stale
  // modules under hot reload, and nothing would say why.
  it('registers the service worker only for a real production build', () => {
    expect(parseConfig({ PROD: true }).config.serviceWorker).toBe(true);
    expect(parseConfig({ PROD: false }).config.serviceWorker).toBe(false);
    expect(parseConfig({ PROD: 'true' }).config.serviceWorker).toBe(false);
    expect(parseConfig({}).config.serviceWorker).toBe(false);
  });

  it('shows only a real commit SHA, shortened', () => {
    expect(parseConfig({ VITE_COMMIT: '290D8B2c1e9f' }).config.commit).toBe('290d8b2');
    expect(parseConfig({}).config.commit).toBeUndefined();
    const bad = parseConfig({ VITE_COMMIT: '<img src=x>' });
    expect(bad.config.commit).toBeUndefined();
    expect(bad.warnings).toHaveLength(1);
  });
});
