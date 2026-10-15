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
});
