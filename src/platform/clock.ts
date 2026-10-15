/** Milliseconds on a monotonic timeline. Injected so logic never reads time itself. */
export type Clock = () => number;

export const browserClock: Clock = () => performance.now();
