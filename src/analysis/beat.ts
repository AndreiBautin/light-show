export interface BeatDetectorOptions {
  /** How far back the adaptive threshold looks. */
  readonly windowMs: number;
  /** A beat must exceed the recent mean by this many standard deviations. */
  readonly sensitivity: number;
  /** Refractory period; 300 ms caps detection at 200 BPM. */
  readonly minIntervalMs: number;
  /** Ignore "beats" in near-silence, where noise dominates the statistics. */
  readonly floor: number;
}

export const DEFAULT_BEAT_OPTIONS: BeatDetectorOptions = {
  windowMs: 1000,
  sensitivity: 1.4,
  minIntervalMs: 300,
  floor: 0.15,
};

interface Sample {
  readonly t: number;
  readonly v: number;
}

/**
 * Energy-onset beat detector with an adaptive threshold. Feed it low-band
 * energy once per frame; it answers whether this frame is a beat. Time is
 * passed in, so it is deterministic under test.
 */
export class BeatDetector {
  private readonly history: Sample[] = [];
  private lastBeat = Number.NEGATIVE_INFINITY;
  private readonly intervals: number[] = [];
  private readonly options: BeatDetectorOptions;

  constructor(options: Partial<BeatDetectorOptions> = {}) {
    this.options = { ...DEFAULT_BEAT_OPTIONS, ...options };
  }

  feed(timeMs: number, energy: number): boolean {
    const { windowMs, sensitivity, minIntervalMs, floor } = this.options;
    while (this.history.length > 0 && (this.history[0]?.t ?? timeMs) < timeMs - windowMs) {
      this.history.shift();
    }

    let isBeat = false;
    if (this.history.length >= 8) {
      const mean = this.history.reduce((s, x) => s + x.v, 0) / this.history.length;
      const variance =
        this.history.reduce((s, x) => s + (x.v - mean) ** 2, 0) / this.history.length;
      const threshold = mean + sensitivity * Math.max(Math.sqrt(variance), 0.02);
      isBeat = energy > threshold && energy > floor && timeMs - this.lastBeat >= minIntervalMs;
    }

    this.history.push({ t: timeMs, v: energy });
    if (isBeat) {
      if (Number.isFinite(this.lastBeat)) {
        this.intervals.push(timeMs - this.lastBeat);
        if (this.intervals.length > 16) this.intervals.shift();
      }
      this.lastBeat = timeMs;
    }
    return isBeat;
  }

  /** Median-interval tempo estimate, or undefined until a few beats have landed. */
  bpm(): number | undefined {
    if (this.intervals.length < 4) return undefined;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return median === undefined ? undefined : 60000 / median;
  }
}
