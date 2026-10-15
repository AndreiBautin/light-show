import { describe, expect, it } from 'vitest';
import { binForHz } from './bands';
import { tonalHeight } from './pitch';

const SR = 48000;
const FFT = 2048;

function tone(...hz: number[]): Float32Array {
  const s = new Float32Array(FFT / 2);
  for (const f of hz) s[binForHz(f, SR, FFT)] = 1;
  return s;
}

describe('tonalHeight', () => {
  // Silently wrong if inverted: high melodies would sink instead of rise.
  it('orders low, middle and high notes', () => {
    const low = tonalHeight(tone(220), SR, FFT) ?? NaN;
    const mid = tonalHeight(tone(880), SR, FFT) ?? NaN;
    const high = tonalHeight(tone(3000), SR, FFT) ?? NaN;
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it('treats each octave equally (log scale)', () => {
    const a = tonalHeight(tone(300), SR, FFT) ?? NaN;
    const b = tonalHeight(tone(600), SR, FFT) ?? NaN;
    const c = tonalHeight(tone(1200), SR, FFT) ?? NaN;
    expect(b - a).toBeCloseTo(c - b, 1);
  });

  it('ignores the bass, so a kick does not drag the melody down', () => {
    const withKick = tone(60, 880);
    expect(tonalHeight(withKick, SR, FFT)).toBeCloseTo(tonalHeight(tone(880), SR, FFT) ?? NaN, 5);
  });

  it('declines to answer in silence', () => {
    expect(tonalHeight(new Float32Array(FFT / 2), SR, FFT)).toBeUndefined();
  });
});
