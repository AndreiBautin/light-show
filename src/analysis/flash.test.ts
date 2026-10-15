import { describe, expect, it } from 'vitest';
import { FlashLimiter } from './flash';

describe('FlashLimiter', () => {
  // The safety property: no one-second window ever contains more than the limit.
  it('never allows more than the limit in any one-second window', () => {
    const limiter = new FlashLimiter(3);
    const granted: number[] = [];
    for (let t = 0; t < 10000; t += 50) if (limiter.tryFlash(t)) granted.push(t);
    for (const start of granted) {
      const inWindow = granted.filter((t) => t >= start && t < start + 1000);
      expect(inWindow.length).toBeLessThanOrEqual(3);
    }
    expect(granted.length).toBeGreaterThan(20);
  });

  it('allows flashes again once the window has passed', () => {
    const limiter = new FlashLimiter(1);
    expect(limiter.tryFlash(0)).toBe(true);
    expect(limiter.tryFlash(500)).toBe(false);
    expect(limiter.tryFlash(1000)).toBe(true);
  });
});
