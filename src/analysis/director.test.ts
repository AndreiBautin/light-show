import { describe, expect, it } from 'vitest';
import { SceneDirector, type DirectorOptions } from './director';

const OPTS: DirectorOptions = { minDwellMs: 1000, maxDwellMs: 5000, fadeMs: 200 };

/** Feed frames every 10 ms from `from` to `to`, returning every frame seen. */
function run(d: SceneDirector, from: number, to: number, dropAt?: number) {
  const frames = [];
  for (let t = from; t <= to; t += 10) frames.push(d.feed(t, t === dropAt));
  return frames;
}

describe('SceneDirector', () => {
  it('holds the first scene at full brightness', () => {
    const d = new SceneDirector(3, 0, OPTS);
    for (const f of run(d, 0, 900)) expect(f).toEqual({ scene: 0, brightness: 1 });
  });

  it('ignores a drop before the minimum dwell', () => {
    const d = new SceneDirector(3, 0, OPTS);
    const frames = run(d, 0, 1500, 500);
    expect(frames.every((f) => f.scene === 0 && f.brightness === 1)).toBe(true);
  });

  it('changes on a drop after the minimum dwell', () => {
    const d = new SceneDirector(3, 0, OPTS);
    run(d, 0, 1990);
    const frames = run(d, 2000, 2400, 2000);
    expect(frames.at(-1)).toEqual({ scene: 1, brightness: 1 });
  });

  it('changes without a drop at the ceiling', () => {
    const d = new SceneDirector(3, 0, OPTS);
    const frames = run(d, 0, 5400);
    expect(frames.at(-1)?.scene).toBe(1);
  });

  // The point of the dip: if the swap happened while the screen was lit, the
  // viewer would see a hard cut between two unrelated pictures.
  it('only swaps scenes at the bottom of the dip', () => {
    const d = new SceneDirector(3, 0, OPTS);
    d.show(2, 0);
    let prev = d.feed(0, false);
    for (let t = 10; t <= 300; t += 10) {
      const f = d.feed(t, false);
      if (f.scene !== prev.scene) expect(Math.min(f.brightness, prev.brightness)).toBeLessThan(0.1);
      prev = f;
    }
    expect(prev).toEqual({ scene: 2, brightness: 1 });
  });

  it('never cycles when auto is off', () => {
    const d = new SceneDirector(3, 0, OPTS);
    d.setAuto(false);
    const frames = run(d, 0, 20_000, 3000);
    expect(frames.every((f) => f.scene === 0)).toBe(true);
  });

  it('steps both ways and wraps', () => {
    const d = new SceneDirector(3, 0, OPTS);
    d.step(-1, 0);
    expect(d.target).toBe(2);
    run(d, 0, 300);
    d.step(1, 400);
    expect(d.target).toBe(0);
  });

  it('restarts the dwell after a change', () => {
    const d = new SceneDirector(3, 0, OPTS);
    run(d, 0, 5400);
    // Just changed to scene 1: a drop right away must not skip on to scene 2.
    const frames = run(d, 5410, 5800, 5500);
    expect(frames.at(-1)?.scene).toBe(1);
  });

  it('retargets a fade already under way without a second dip', () => {
    const d = new SceneDirector(4, 0, OPTS);
    d.show(1, 0);
    let prev = d.feed(50, false); // halfway down
    d.show(3, 60);
    let lowest = prev.brightness;
    const seen = new Set([prev.scene]);
    for (let t = 60; t <= 400; t += 10) {
      const f = d.feed(t, false);
      // Still heading down: no frame may brighten before the swap.
      if (f.scene === 0) expect(f.brightness).toBeLessThanOrEqual(prev.brightness);
      lowest = Math.min(lowest, f.brightness);
      seen.add(f.scene);
      prev = f;
    }
    // Lands on the newest choice and never shows scene 1 at all.
    expect(prev).toEqual({ scene: 3, brightness: 1 });
    expect(seen.has(1)).toBe(false);
    expect(lowest).toBeLessThan(0.1);
  });

  it('finishes a fade that started in auto even if auto is turned off', () => {
    const d = new SceneDirector(3, 0, OPTS);
    run(d, 0, 5010); // the ceiling starts a fade to scene 1
    d.setAuto(false);
    expect(run(d, 5020, 5400).at(-1)).toEqual({ scene: 1, brightness: 1 });
  });

  it('with a single scene never fades, whatever happens', () => {
    const d = new SceneDirector(1, 0, OPTS);
    d.step(1, 0);
    const frames = run(d, 0, 20_000, 3000);
    expect(frames.every((f) => f.scene === 0 && f.brightness === 1)).toBe(true);
  });

  it('refuses to be built with no scenes', () => {
    expect(() => new SceneDirector(0)).toThrow();
  });
});
