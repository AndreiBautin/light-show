/** Loudness per musical region, each normalised to 0..1. */
export interface Bands {
  readonly bass: number;
  readonly mid: number;
  readonly treble: number;
}

export const BAND_EDGES_HZ = {
  bassLow: 20,
  bassHigh: 150,
  midHigh: 2000,
  trebleHigh: 12000,
} as const;

/** Index of the FFT bin containing `hz`. Bin k spans k * sampleRate / fftSize. */
export function binForHz(hz: number, sampleRate: number, fftSize: number): number {
  return Math.floor((hz * fftSize) / sampleRate);
}

function meanOf(spectrum: ArrayLike<number>, from: number, to: number): number {
  const end = Math.min(to, spectrum.length);
  if (end <= from) return 0;
  let sum = 0;
  for (let i = from; i < end; i++) sum += spectrum[i] ?? 0;
  return sum / (end - from);
}

/**
 * @param spectrum magnitudes already scaled to 0..1, one per bin (length fftSize / 2)
 */
export function computeBands(
  spectrum: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
): Bands {
  const bin = (hz: number): number => binForHz(hz, sampleRate, fftSize);
  const e = BAND_EDGES_HZ;
  return {
    bass: meanOf(spectrum, Math.max(1, bin(e.bassLow)), bin(e.bassHigh) + 1),
    mid: meanOf(spectrum, bin(e.bassHigh) + 1, bin(e.midHigh) + 1),
    treble: meanOf(spectrum, bin(e.midHigh) + 1, bin(e.trebleHigh) + 1),
  };
}
