/**
 * Which screensaver is on, and when to change it. Auto mode moves on at a
 * drop once a scene has had a fair run, so changes land on a musical moment;
 * if the song never drops it moves on anyway after a ceiling. Every change
 * dips through black and comes back up, and the scene swaps at the bottom of
 * the dip so no frame ever shows a cut.
 */

export interface DirectorOptions {
  /** A scene plays at least this long before a drop may change it. */
  readonly minDwellMs: number;
  /** ...and changes after this long even without a drop. */
  readonly maxDwellMs: number;
  /** Total length of the dip: half down to black, half back up. */
  readonly fadeMs: number;
}

export const DEFAULT_DIRECTOR_OPTIONS: DirectorOptions = {
  minDwellMs: 40_000,
  maxDwellMs: 120_000,
  fadeMs: 1600,
};

export interface DirectorFrame {
  /** Index of the scene to draw this frame. */
  readonly scene: number;
  /** Brightness multiplier, 1 normally and 0 at the bottom of a change. */
  readonly brightness: number;
}

interface Transition {
  readonly startMs: number;
  readonly to: number;
}

export class SceneDirector {
  private current: number;
  private shownSinceMs: number | undefined;
  private transition: Transition | undefined;
  private autoCycle = true;
  private readonly count: number;
  private readonly options: DirectorOptions;

  constructor(count: number, initial = 0, options: DirectorOptions = DEFAULT_DIRECTOR_OPTIONS) {
    if (count < 1) throw new Error('SceneDirector needs at least one scene');
    this.count = count;
    this.options = options;
    this.current = wrap(initial, count);
  }

  get auto(): boolean {
    return this.autoCycle;
  }

  /** Whether scenes change by themselves. Picking a scene by hand turns it off. */
  setAuto(on: boolean): void {
    this.autoCycle = on;
  }

  /** The scene being shown, or the one being faded to. */
  get target(): number {
    return this.transition?.to ?? this.current;
  }

  /** Fade to a specific scene. Ignored if it is already showing or on its way. */
  show(index: number, nowMs: number): void {
    const to = wrap(index, this.count);
    if (to === this.target) return;
    this.transition = { startMs: nowMs, to };
  }

  /** Fade to the scene `step` places along from the current target. */
  step(step: number, nowMs: number): void {
    this.show(this.target + step, nowMs);
  }

  /** Advance one frame. `drop` is true on the frame the music drops. */
  feed(nowMs: number, drop: boolean): DirectorFrame {
    this.shownSinceMs ??= nowMs;

    if (!this.transition && this.autoCycle && this.count > 1) {
      const dwell = nowMs - this.shownSinceMs;
      if ((drop && dwell >= this.options.minDwellMs) || dwell >= this.options.maxDwellMs) {
        this.transition = { startMs: nowMs, to: wrap(this.current + 1, this.count) };
      }
    }

    if (!this.transition) return { scene: this.current, brightness: 1 };

    const half = this.options.fadeMs / 2;
    const elapsed = nowMs - this.transition.startMs;
    if (elapsed < half) {
      return { scene: this.current, brightness: 1 - elapsed / half };
    }
    if (this.current !== this.transition.to) {
      this.current = this.transition.to;
      this.shownSinceMs = nowMs;
    }
    if (elapsed >= this.options.fadeMs) {
      this.transition = undefined;
      return { scene: this.current, brightness: 1 };
    }
    return { scene: this.current, brightness: (elapsed - half) / half };
  }
}

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}
