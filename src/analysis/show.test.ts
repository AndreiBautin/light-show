import { describe, expect, it } from 'vitest';
import { INITIAL_SHOW, envelope, flowRate, stepShow } from './show';

const quiet = { bass: 0, mid: 0, treble: 0 };
const calm = { intensity: 0, build: 0, release: 0 };

describe('stepShow', () => {
  it('only flashes when the limiter allowed it, but always pulses on a beat', () => {
    const denied = stepShow(INITIAL_SHOW, {
      timeMs: 16,
      bands: quiet,
      beat: true,
      flashAllowed: false,
      structure: calm,
      pitch: undefined,
    });
    expect(denied.pulse).toBe(1);
    expect(denied.flash).toBe(0);
    expect(denied.beats).toBe(1);
  });

  it('decays the pulse between beats', () => {
    const hit = stepShow(INITIAL_SHOW, {
      timeMs: 0,
      bands: quiet,
      beat: true,
      flashAllowed: true,
      structure: calm,
      pitch: undefined,
    });
    const mid = stepShow(hit, {
      timeMs: 70,
      bands: quiet,
      beat: false,
      flashAllowed: false,
      structure: calm,
      pitch: undefined,
    });
    const later = stepShow(mid, {
      timeMs: 140,
      bands: quiet,
      beat: false,
      flashAllowed: false,
      structure: calm,
      pitch: undefined,
    });
    expect(later.pulse).toBeCloseTo(Math.pow(0.5, 140 / 350), 5);
  });

  it('survives a long stall (tab in background) without blowing up', () => {
    const s = stepShow(INITIAL_SHOW, {
      timeMs: 60_000,
      bands: { bass: 1, mid: 1, treble: 1 },
      beat: false,
      flashAllowed: false,
      structure: calm,
      pitch: undefined,
    });
    for (const v of [s.bass, s.mid, s.treble, s.pulse, s.flash]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('flow', () => {
  // Silently wrong if broken: the scene would jump instead of drift.
  it('never jumps when the music suddenly gets loud', () => {
    let s = INITIAL_SHOW;
    let t = 0;
    for (let i = 0; i < 20_000; i++) {
      t += 16;
      const loud = i % 600 < 300;
      const level = loud ? 1 : 0;
      const next = stepShow(s, {
        timeMs: t,
        bands: { bass: level, mid: level, treble: level },
        beat: false,
        flashAllowed: false,
        structure: calm,
        pitch: undefined,
      });
      const advance = next.flow - s.flow;
      expect(advance).toBeGreaterThan(0);
      expect(advance).toBeLessThanOrEqual(0.016 * flowRate(1, 1) + 1e-9);
      s = next;
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
