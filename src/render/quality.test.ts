import { describe, expect, it } from 'vitest';
import { DEFAULT_GOVERNOR, ResolutionGovernor } from './quality';

function run(g: ResolutionGovernor, frameMs: number, forMs: number): number {
  let scale = g.scale;
  for (let t = 0; t < forMs; t += frameMs) scale = g.feed(frameMs);
  return scale;
}

describe('ResolutionGovernor', () => {
  it('stays at full scale when frames are on time', () => {
    expect(run(new ResolutionGovernor(), 16.7, 30_000)).toBe(1);
  });

  it('steps down when frames run long, but not below the floor', () => {
    const g = new ResolutionGovernor();
    expect(run(g, 33, 1500)).toBeLessThan(1);
    expect(run(g, 50, 30_000)).toBe(DEFAULT_GOVERNOR.min);
  });

  // A GPU managing only a few frames a second is the case that needs help most.
  it('still steps down when frames are very slow', () => {
    expect(run(new ResolutionGovernor(), 400, 10_000)).toBeLessThan(1);
  });

  // Silently wrong if broken: a single hitch (GC, tab switch) would cost
  // resolution for the next eight seconds.
  it('ignores a brief hitch and a backgrounded tab', () => {
    const g = new ResolutionGovernor();
    run(g, 16.7, 2000);
    g.feed(80);
    g.feed(2000);
    expect(run(g, 16.7, 2000)).toBe(1);
  });

  it('climbs back only after a long steady stretch', () => {
    const g = new ResolutionGovernor();
    run(g, 40, 3000);
    const low = g.scale;
    expect(run(g, 16.7, 4000)).toBe(low);
    expect(run(g, 16.7, 10_000)).toBeGreaterThan(low);
  });
});
