import { describe, expect, it } from 'vitest';
import { BeatDetector } from './beat';

const FRAME_MS = 1000 / 60;

/** Synthetic bass envelope: a kick every `periodMs` decaying over ~80 ms. */
function kickTrack(periodMs: number, durationMs: number, level = 0.9, bed = 0.2): number[][] {
  const frames: number[][] = [];
  for (let t = 0; t < durationMs; t += FRAME_MS) {
    const sinceKick = t % periodMs;
    frames.push([t, bed + level * Math.exp(-sinceKick / 40)]);
  }
  return frames;
}

function run(det: BeatDetector, frames: number[][]): number[] {
  const beats: number[] = [];
  for (const [t = 0, v = 0] of frames) if (det.feed(t, v)) beats.push(t);
  return beats;
}

describe('BeatDetector', () => {
  it('finds a steady 120 BPM kick and estimates the tempo', () => {
    const det = new BeatDetector();
    const beats = run(det, kickTrack(500, 10000));
    // First second warms up the threshold; after that, every kick should land.
    expect(beats.length).toBeGreaterThanOrEqual(17);
    expect(beats.length).toBeLessThanOrEqual(20);
    expect(det.bpm()).toBeCloseTo(120, -1);
  });

  it('does not fire on a sustained tone', () => {
    const det = new BeatDetector();
    const frames = kickTrack(1e9, 5000, 0, 0.7);
    expect(run(det, frames)).toEqual([]);
  });

  it('stays quiet in near-silence even when it is noisy', () => {
    const det = new BeatDetector();
    const frames = kickTrack(500, 5000, 0.08, 0.01);
    expect(run(det, frames)).toEqual([]);
  });

  it('never reports beats closer than the refractory period', () => {
    const det = new BeatDetector({ minIntervalMs: 300 });
    const beats = run(det, kickTrack(150, 5000));
    for (let i = 1; i < beats.length; i++) {
      expect((beats[i] ?? 0) - (beats[i - 1] ?? 0)).toBeGreaterThanOrEqual(300);
    }
  });
});
