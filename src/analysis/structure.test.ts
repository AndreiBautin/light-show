import { describe, expect, it } from 'vitest';
import { StructureTracker, type StructureReading } from './structure';

const FRAME = 1000 / 60;

/** Runs an energy curve (seconds → energy) and returns readings keyed by time. */
function run(curve: (s: number) => number, seconds: number): { t: number; r: StructureReading }[] {
  const tracker = new StructureTracker();
  const out: { t: number; r: StructureReading }[] = [];
  for (let t = 0; t < seconds * 1000; t += FRAME) {
    out.push({ t, r: tracker.feed(t, curve(t / 1000)) });
  }
  return out;
}

const drops = (rs: { t: number; r: StructureReading }[]): number[] => {
  const at: number[] = [];
  for (let i = 1; i < rs.length; i++) {
    const prev = rs[i - 1];
    const cur = rs[i];
    if (prev && cur && cur.r.release === 1 && prev.r.release < 1) at.push(cur.t);
  }
  return at;
};

const at = (rs: { t: number; r: StructureReading }[], seconds: number): StructureReading => {
  const hit = rs.find((x) => x.t >= seconds * 1000);
  if (!hit) throw new Error('out of range');
  return hit.r;
};

describe('StructureTracker', () => {
  it('fires exactly one drop when a quiet section gives way to a loud one', () => {
    const rs = run((s) => (s < 20 ? 0.12 : 0.5), 40);
    const d = drops(rs);
    expect(d).toHaveLength(1);
    expect(d[0]).toBeGreaterThan(20_000);
    expect(d[0]).toBeLessThan(23_000);
  });

  // Silently wrong if broken: a steady loud track would "drop" forever.
  it('never fires a drop on steady music, whatever its level', () => {
    for (const level of [0.05, 0.3, 0.9]) {
      expect(drops(run(() => level, 60))).toEqual([]);
    }
  });

  it('reports a build while energy climbs and lets it go once it levels off', () => {
    const rs = run((s) => (s < 10 ? 0.15 : s < 25 ? 0.15 + ((s - 10) / 15) * 0.25 : 0.4), 45);
    expect(at(rs, 22).build).toBeGreaterThan(0.3);
    expect(at(rs, 44).build).toBeLessThan(0.1);
  });

  it('reads a breakdown as low intensity', () => {
    const rs = run((s) => (s < 30 ? 0.5 : 0.12), 40);
    expect(at(rs, 25).intensity).toBeGreaterThan(0.4);
    expect(at(rs, 36).intensity).toBeLessThan(0.3);
  });

  it('treats silence as zero intensity, not as division noise', () => {
    const rs = run(() => 0, 10);
    for (const { r } of rs) {
      expect(r.intensity).toBe(0);
      expect(Number.isFinite(r.build)).toBe(true);
    }
  });
});
