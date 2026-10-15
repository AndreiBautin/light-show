import { describe, expect, it } from 'vitest';
import { INITIAL_SHOW, envelope, stepShow } from './show';

const quiet = { bass: 0, mid: 0, treble: 0 };

describe('stepShow', () => {
  it('only flashes when the limiter allowed it, but always pulses on a beat', () => {
    const denied = stepShow(INITIAL_SHOW, {
      timeMs: 16,
      bands: quiet,
      beat: true,
      flashAllowed: false,
    });
    expect(denied.pulse).toBe(1);
    expect(denied.flash).toBe(0);
    expect(denied.beats).toBe(1);
  });

  it('decays the pulse between beats', () => {
    const hit = stepShow(INITIAL_SHOW, { timeMs: 0, bands: quiet, beat: true, flashAllowed: true });
    const mid = stepShow(hit, { timeMs: 70, bands: quiet, beat: false, flashAllowed: false });
    const later = stepShow(mid, { timeMs: 140, bands: quiet, beat: false, flashAllowed: false });
    expect(later.pulse).toBeCloseTo(0.5, 5);
  });

  it('survives a long stall (tab in background) without blowing up', () => {
    const s = stepShow(INITIAL_SHOW, {
      timeMs: 60_000,
      bands: { bass: 1, mid: 1, treble: 1 },
      beat: false,
      flashAllowed: false,
    });
    for (const v of [s.bass, s.mid, s.treble, s.pulse, s.flash]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('envelope', () => {
  it('rises faster than it falls', () => {
    const up = envelope(0, 1, 16, 15, 180);
    const down = 1 - envelope(1, 0, 16, 15, 180);
    expect(up).toBeGreaterThan(down);
  });
});
