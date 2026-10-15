/**
 * Song structure from loudness over time. Compares the last ~1.5 s with the
 * last ~15 s so the show can tell a quiet intro, a build, a drop and a
 * breakdown apart, independent of how loud the track is mastered.
 */

export interface StructureReading {
  /** How hard the music is going relative to its own recent average. */
  readonly intensity: number;
  /** Rises while energy climbs steadily (a riser, a build). */
  readonly build: number;
  /** Jumps to 1 at a drop and fades over a few seconds. */
  readonly release: number;
}

export interface StructureOptions {
  readonly shortTauMs: number;
  readonly longTauMs: number;
  /** Lookback for the "sudden rise" that marks a drop. */
  readonly dropLookbackMs: number;
  /** A drop needs short-term energy this much above the long-term average. */
  readonly dropRatio: number;
  /** Minimum time between drops: real ones are bars apart, not beats. */
  readonly dropCooldownMs: number;
  readonly releaseHalfLifeMs: number;
  /** Below this short-term energy everything reads as silence. */
  readonly silence: number;
}

export const DEFAULT_STRUCTURE_OPTIONS: StructureOptions = {
  shortTauMs: 1500,
  longTauMs: 15000,
  dropLookbackMs: 2000,
  dropRatio: 1.3,
  dropCooldownMs: 8000,
  releaseHalfLifeMs: 2500,
  silence: 0.03,
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const ema = (prev: number, x: number, dtMs: number, tauMs: number): number =>
  prev + (x - prev) * (1 - Math.exp(-dtMs / tauMs));

export class StructureTracker {
  private readonly o: StructureOptions;
  private lastT: number | undefined;
  private firstT = 0;
  private shortE = 0;
  private longE = 0;
  private trend = 0;
  private build = 0;
  private release = 0;
  private lastDrop = Number.NEGATIVE_INFINITY;
  private readonly recent: { t: number; e: number }[] = [];

  constructor(options: Partial<StructureOptions> = {}) {
    this.o = { ...DEFAULT_STRUCTURE_OPTIONS, ...options };
  }

  feed(timeMs: number, energy: number): StructureReading {
    const o = this.o;
    const dt = this.lastT === undefined ? 0 : Math.min(100, Math.max(0, timeMs - this.lastT));
    if (this.lastT === undefined) {
      // Seed from the first sample: starting both averages at zero would make
      // the opening seconds look like a sudden rise, i.e. a false drop.
      this.firstT = timeMs;
      this.shortE = energy;
      this.longE = energy;
    }
    this.lastT = timeMs;

    const prevShort = this.shortE;
    this.shortE = ema(this.shortE, energy, dt, o.shortTauMs);
    this.longE = ema(this.longE, energy, dt, o.longTauMs);

    // Slope of short-term energy, per second, relative to the track's level.
    const slope = dt > 0 ? ((this.shortE - prevShort) / dt) * 1000 : 0;
    const level = Math.max(this.longE, o.silence);
    this.trend = ema(this.trend, slope / level, dt, 3000);
    this.build = ema(this.build, clamp01(this.trend * 4), dt, this.trend > 0 ? 1500 : 600);

    this.recent.push({ t: timeMs, e: this.shortE });
    while ((this.recent[0]?.t ?? timeMs) < timeMs - o.dropLookbackMs) this.recent.shift();
    const before = this.recent[0]?.e ?? this.shortE;

    const ratio = this.shortE / level;
    const rose = this.shortE - before > 0.35 * level;
    const loudEnough = this.shortE > o.silence * 2;
    const warmedUp = timeMs - this.firstT >= 5000;
    if (
      ratio > o.dropRatio &&
      rose &&
      loudEnough &&
      warmedUp &&
      timeMs - this.lastDrop >= o.dropCooldownMs
    ) {
      this.lastDrop = timeMs;
      this.release = 1;
      this.build = 0;
    } else {
      this.release *= Math.pow(0.5, dt / o.releaseHalfLifeMs);
    }

    const audible = clamp01(this.shortE / (o.silence * 3));
    return {
      intensity: clamp01((ratio - 0.5) / 1.0) * audible,
      build: this.build,
      release: this.release,
    };
  }
}
