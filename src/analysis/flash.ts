/**
 * Photosensitivity guard: allows at most `maxPerSecond` flashes in any
 * sliding one-second window (WCAG 2.3.1 sets the ceiling at 3).
 */
export class FlashLimiter {
  private readonly recent: number[] = [];

  private readonly maxPerSecond: number;

  constructor(maxPerSecond: number) {
    this.maxPerSecond = maxPerSecond;
  }

  /** Returns true and records the flash if one is allowed at `timeMs`. */
  tryFlash(timeMs: number): boolean {
    while (this.recent.length > 0 && (this.recent[0] ?? timeMs) <= timeMs - 1000) {
      this.recent.shift();
    }
    if (this.recent.length >= this.maxPerSecond) return false;
    this.recent.push(timeMs);
    return true;
  }
}
