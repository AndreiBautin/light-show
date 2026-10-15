import { binForHz } from './bands';

export const PITCH_RANGE_HZ = { low: 150, high: 5000 } as const;

/**
 * Tonal height: where the energy of the melodic range sits, 0 (low) to 1
 * (high), on a log scale so each octave counts the same. It is the spectral
 * centroid rather than a true pitch tracker: robust on dense mixes, where
 * picking "the" note would flicker between instruments.
 *
 * Returns undefined when there is too little tonal energy to judge, so the
 * caller can hold the last value instead of snapping to 0 in every gap.
 */
export function tonalHeight(
  spectrum: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
): number | undefined {
  const from = binForHz(PITCH_RANGE_HZ.low, sampleRate, fftSize);
  const to = Math.min(spectrum.length - 1, binForHz(PITCH_RANGE_HZ.high, sampleRate, fftSize));
  let weight = 0;
  let sum = 0;
  for (let i = from; i <= to; i++) {
    const m = spectrum[i] ?? 0;
    // Squaring favours the prominent partials over the noise floor.
    const w = m * m;
    weight += w;
    sum += (w * ((i + 0.5) * sampleRate)) / fftSize;
  }
  if (weight < 0.05) return undefined;
  const centroid = sum / weight;
  const octaves = Math.log2(PITCH_RANGE_HZ.high / PITCH_RANGE_HZ.low);
  return Math.min(1, Math.max(0, Math.log2(centroid / PITCH_RANGE_HZ.low) / octaves));
}
