import { describe, expect, it } from 'vitest';
import { binForHz, computeBands } from './bands';

const SAMPLE_RATE = 48000;
const FFT = 2048;

function spectrumWithEnergyAt(hz: number): Float32Array {
  const s = new Float32Array(FFT / 2);
  s[binForHz(hz, SAMPLE_RATE, FFT)] = 1;
  return s;
}

describe('computeBands', () => {
  // Silently wrong if the bin maths drifts: the kick would drive the treble.
  it('puts a 60 Hz kick in bass only', () => {
    const b = computeBands(spectrumWithEnergyAt(60), SAMPLE_RATE, FFT);
    expect(b.bass).toBeGreaterThan(0);
    expect(b.mid).toBe(0);
    expect(b.treble).toBe(0);
  });

  it('puts a 1 kHz tone in mid and an 8 kHz hat in treble', () => {
    expect(computeBands(spectrumWithEnergyAt(1000), SAMPLE_RATE, FFT).mid).toBeGreaterThan(0);
    const hat = computeBands(spectrumWithEnergyAt(8000), SAMPLE_RATE, FFT);
    expect(hat.treble).toBeGreaterThan(0);
    expect(hat.bass).toBe(0);
  });

  it('ignores the DC bin', () => {
    const s = new Float32Array(FFT / 2);
    s[0] = 1;
    expect(computeBands(s, SAMPLE_RATE, FFT).bass).toBe(0);
  });
});
