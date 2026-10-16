export type Gesture = 'next' | 'previous' | 'tap' | 'none';

/**
 * What a finished touch meant, from how far it moved (px) and how long it
 * took (ms). A swipe must be mostly sideways so a vertical scroll attempt
 * does not change the scene; a tap must be short and nearly still.
 */
export function classifyTouch(dx: number, dy: number, ms: number): Gesture {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= 60 && ax > ay * 1.5 && ms < 800) return dx < 0 ? 'next' : 'previous';
  if (ax < 12 && ay < 12 && ms < 300) return 'tap';
  return 'none';
}
