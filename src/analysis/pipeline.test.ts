import { describe, expect, it } from 'vitest';
import { ShowPipeline, type SpectrumFrame } from './pipeline';

const FFT = 2048;
const RATE = 48000;

/** A spectrum with everything below `hz` at `level`. */
function lowEnd(level: number, hz = 150): SpectrumFrame {
  const spectrum = new Float32Array(FFT / 2);
  const top = Math.floor((hz / (RATE / 2)) * spectrum.length);
  for (let i = 0; i < top; i++) spectrum[i] = level;
  return { spectrum, sampleRate: RATE, fftSize: FFT };
}

describe('ShowPipeline', () => {
  it('keeps the show drifting with no input at all', () => {
    const p = new ShowPipeline(3);
    let flow = 0;
    for (let t = 0; t <= 2000; t += 16) flow = p.feed(t, undefined).show.flow;
    expect(flow).toBeGreaterThan(1.5);
  });

  // The flash ceiling is a safety rule: however often the kicks land, flashes
  // must never exceed the configured rate.
  it('never flashes more often than the limit, however hard the kicks', () => {
    // ~3 kicks a second against a limit of 1: the limit, not the kicks, must win.
    const p = new ShowPipeline(1);
    let flashes = 0;
    let prev = 0;
    for (let t = 0; t <= 10_000; t += 16) {
      const kick = lowEnd(Math.min(1, 0.2 + 0.9 * Math.exp(-(t % 330) / 40)));
      const f = p.feed(t, kick).show.flash;
      if (f === 1 && prev !== 1) flashes++;
      prev = f;
    }
    expect(flashes).toBeGreaterThan(3);
    expect(flashes).toBeLessThanOrEqual(11);
  });

  it('carries the picture across a source change without a jump', () => {
    const p = new ShowPipeline(3);
    let last = p.feed(0, lowEnd(0.8)).show;
    for (let t = 16; t < 1000; t += 16) last = p.feed(t, lowEnd(0.8)).show;
    p.newSource();
    const after = p.feed(1016, lowEnd(0.8)).show;
    expect(after.flow - last.flow).toBeLessThan(0.1);
    expect(Math.abs(after.bass - last.bass)).toBeLessThan(0.05);
  });

  it('moves more slowly under reduced motion, and never flashes', () => {
    const normal = new ShowPipeline(3);
    const reduced = new ShowPipeline(3);
    reduced.setReducedMotion(true);
    let a = 0;
    let b = 0;
    let flashed = false;
    for (let t = 0; t <= 5000; t += 16) {
      const kick = lowEnd(Math.min(1, 0.2 + 0.9 * Math.exp(-(t % 500) / 40)));
      a = normal.feed(t, kick).show.flow;
      const s = reduced.feed(t, kick).show;
      b = s.flow;
      flashed ||= s.flash > 0;
    }
    expect(b).toBeCloseTo(a * 0.4, 5);
    expect(flashed).toBe(false);
  });
});
