import { computeBands, type Bands } from './bands';
import { BeatDetector } from './beat';
import { FlashLimiter } from './flash';
import { tonalHeight } from './pitch';
import { INITIAL_SHOW, stepShow, type ShowState } from './show';
import { StructureTracker } from './structure';

/** One analyser read: magnitudes 0..1 per bin, and what they are bins of. */
export interface SpectrumFrame {
  readonly spectrum: Float32Array;
  readonly sampleRate: number;
  readonly fftSize: number;
}

export interface PipelineFrame {
  readonly show: ShowState;
  /** True on the one frame the music drops. */
  readonly drop: boolean;
}

const SILENT: Bands = { bass: 0, mid: 0, treble: 0 };

/**
 * Everything that turns a spectrum into the show's state, frame by frame:
 * bands, beats (for the flash limiter only), song structure, pitch, and the
 * smoothed ShowState. With no input it keeps the show drifting in silence.
 */
export class ShowPipeline {
  private beats = new BeatDetector();
  private structure = new StructureTracker();
  private flashes: FlashLimiter;
  private show: ShowState = INITIAL_SHOW;
  private readonly maxFlashesPerSecond: number;

  constructor(maxFlashesPerSecond: number) {
    this.maxFlashesPerSecond = maxFlashesPerSecond;
    this.flashes = new FlashLimiter(maxFlashesPerSecond);
  }

  /**
   * Forget the previous source's history (its loudness, tempo and flash
   * budget) but keep the show state, so the picture carries on unbroken.
   */
  newSource(): void {
    this.beats = new BeatDetector();
    this.structure = new StructureTracker();
    this.flashes = new FlashLimiter(this.maxFlashesPerSecond);
  }

  feed(nowMs: number, input: SpectrumFrame | undefined): PipelineFrame {
    let bands = SILENT;
    let beat = false;
    let pitch: number | undefined;
    if (input) {
      bands = computeBands(input.spectrum, input.sampleRate, input.fftSize);
      beat = this.beats.feed(nowMs, bands.bass);
      pitch = tonalHeight(input.spectrum, input.sampleRate, input.fftSize);
    }
    const energy = 0.5 * bands.bass + 0.35 * bands.mid + 0.15 * bands.treble;
    const reading = this.structure.feed(nowMs, energy);
    const flashAllowed = beat && this.flashes.tryFlash(nowMs);
    this.show = stepShow(this.show, {
      timeMs: nowMs,
      bands,
      flashAllowed,
      structure: reading,
      pitch,
    });
    return { show: this.show, drop: reading.release === 1 };
  }
}
