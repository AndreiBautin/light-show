import type { Bands } from './bands';

/** Everything the renderer needs for one frame. All values are 0..1 unless noted. */
export interface ShowState {
  readonly timeMs: number;
  readonly bass: number;
  readonly mid: number;
  readonly treble: number;
  /** Jumps to 1 on each beat and decays; drives the pulse. */
  readonly pulse: number;
  /** Full-screen brightness kick; only set when the flash limiter allows. */
  readonly flash: number;
  /** Count of beats so far; the scene uses it to step its palette. */
  readonly beats: number;
}

export const INITIAL_SHOW: ShowState = {
  timeMs: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  pulse: 0,
  flash: 0,
  beats: 0,
};

export interface FrameInput {
  readonly timeMs: number;
  readonly bands: Bands;
  readonly beat: boolean;
  /** Whether the flash limiter granted a flash on this beat. */
  readonly flashAllowed: boolean;
}

/** Fast rise, slow fall: the motion reads as musical rather than jittery. */
export function envelope(
  prev: number,
  target: number,
  dtMs: number,
  attackMs: number,
  releaseMs: number,
): number {
  const tau = target > prev ? attackMs : releaseMs;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tau);
  return prev + (target - prev) * k;
}

const decay = (v: number, dtMs: number, halfLifeMs: number): number =>
  v * Math.pow(0.5, dtMs / halfLifeMs);

export function stepShow(prev: ShowState, input: FrameInput): ShowState {
  const dt = Math.min(100, Math.max(0, input.timeMs - prev.timeMs));
  return {
    timeMs: input.timeMs,
    bass: envelope(prev.bass, input.bands.bass, dt, 40, 450),
    mid: envelope(prev.mid, input.bands.mid, dt, 30, 250),
    treble: envelope(prev.treble, input.bands.treble, dt, 10, 120),
    pulse: input.beat ? 1 : decay(prev.pulse, dt, 140),
    flash: input.beat && input.flashAllowed ? 1 : decay(prev.flash, dt, 60),
    beats: prev.beats + (input.beat ? 1 : 0),
  };
}
