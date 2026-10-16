/**
 * Adaptive render scale. Watches frame times and trades resolution for frame
 * rate: down quickly when frames run long, back up slowly and only after a
 * long steady stretch, so it settles instead of oscillating. Pure, so it is
 * tested with synthetic frame times.
 */

export interface GovernorOptions {
  /** Frames slower than this (ms, smoothed) count as struggling. ~45 fps. */
  readonly slowMs: number;
  /** Frames faster than this count as having headroom. */
  readonly fastMs: number;
  /** How long struggling before stepping down, and steady before stepping up. */
  readonly downAfterMs: number;
  readonly upAfterMs: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const DEFAULT_GOVERNOR: GovernorOptions = {
  slowMs: 22,
  fastMs: 18,
  downAfterMs: 1000,
  upAfterMs: 8000,
  min: 0.5,
  max: 1,
  step: 0.15,
};

export class ResolutionGovernor {
  private smoothed: number | undefined;
  private slowFor = 0;
  private fastFor = 0;
  private current: number;
  private readonly options: GovernorOptions;

  constructor(options: GovernorOptions = DEFAULT_GOVERNOR) {
    this.options = options;
    this.current = options.max;
  }

  get scale(): number {
    return this.current;
  }

  /** Feed the time since the previous frame; returns the scale to render at. */
  feed(frameMs: number): number {
    const o = this.options;
    // A backgrounded tab or a debugger pause is not the GPU struggling.
    if (frameMs <= 0 || frameMs > 250) return this.current;
    this.smoothed = this.smoothed === undefined ? frameMs : this.smoothed * 0.9 + frameMs * 0.1;

    if (this.smoothed > o.slowMs) {
      this.slowFor += frameMs;
      this.fastFor = 0;
    } else if (this.smoothed < o.fastMs) {
      this.fastFor += frameMs;
      this.slowFor = 0;
    } else {
      this.slowFor = 0;
      this.fastFor = 0;
    }

    if (this.slowFor >= o.downAfterMs && this.current > o.min) {
      this.current = Math.max(o.min, this.current - o.step);
      this.slowFor = 0;
      // Give the new size a moment before judging it.
      this.smoothed = undefined;
    } else if (this.fastFor >= o.upAfterMs && this.current < o.max) {
      this.current = Math.min(o.max, this.current + o.step);
      this.fastFor = 0;
      this.smoothed = undefined;
    }
    return this.current;
  }
}
