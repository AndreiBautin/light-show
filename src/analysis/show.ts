import type { Bands } from './bands';
import type { StructureReading } from './structure';

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
  /**
   * Accumulated flow phase in seconds. Music changes its rate, never its value,
   * so motion can speed up or slow down but never jump. (Scaling absolute time
   * by a level instead makes the whole field teleport minutes into a song.)
   */
  readonly flow: number;
  /** Song-level energy relative to its own recent past (see structure.ts). */
  readonly intensity: number;
  readonly build: number;
  readonly release: number;
  /** Tonal height of the melody, held through gaps. */
  readonly pitch: number;
}

export const INITIAL_SHOW: ShowState = {
  timeMs: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  pulse: 0,
  flash: 0,
  beats: 0,
  flow: 0,
  intensity: 0,
  build: 0,
  release: 0,
  pitch: 0.5,
};

export interface FrameInput {
  readonly timeMs: number;
  readonly bands: Bands;
  readonly beat: boolean;
  /** Whether the flash limiter granted a flash on this beat. */
  readonly flashAllowed: boolean;
  readonly structure: StructureReading;
  /** Undefined when there is too little tonal energy to judge. */
  readonly pitch: number | undefined;
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

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Lava-lamp pace: always drifting, quicker when the music is busy, and
 * briefly surging after a drop.
 */
export function flowRate(mid: number, release: number): number {
  return 1.0 + 1.0 * clamp01(mid) + 1.5 * clamp01(release);
}

export function stepShow(prev: ShowState, input: FrameInput): ShowState {
  const dt = Math.min(100, Math.max(0, input.timeMs - prev.timeMs));
  return {
    timeMs: input.timeMs,
    bass: envelope(prev.bass, input.bands.bass, dt, 900, 2200),
    mid: envelope(prev.mid, input.bands.mid, dt, 900, 2200),
    treble: envelope(prev.treble, input.bands.treble, dt, 600, 1500),
    pulse: input.beat ? 1 : decay(prev.pulse, dt, 350),
    flash: input.beat && input.flashAllowed ? 1 : decay(prev.flash, dt, 60),
    beats: prev.beats + (input.beat ? 1 : 0),
    flow: prev.flow + (dt / 1000) * flowRate(prev.mid, prev.release),
    intensity: envelope(prev.intensity, input.structure.intensity, dt, 800, 2500),
    build: input.structure.build,
    release: input.structure.release,
    pitch: envelope(prev.pitch, input.pitch ?? prev.pitch, dt, 700, 700),
  };
}
