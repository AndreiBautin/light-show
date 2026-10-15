import type { LogLevel } from './logger';

export interface Config {
  readonly logLevel: LogLevel;
  /** Upper bound on full-screen flashes per second. WCAG 2.3.1 allows at most 3. */
  readonly maxFlashesPerSecond: number;
}

export const DEFAULT_CONFIG: Config = { logLevel: 'info', maxFlashesPerSecond: 3 };

export interface ParsedConfig {
  readonly config: Config;
  readonly warnings: readonly string[];
}

const LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/** Total: never throws. Bad input falls back to the documented default with a warning. */
export function parseConfig(env: Readonly<Record<string, unknown>>): ParsedConfig {
  const warnings: string[] = [];

  let logLevel = DEFAULT_CONFIG.logLevel;
  const rawLevel = env.VITE_LOG_LEVEL;
  if (rawLevel !== undefined) {
    const found = LEVELS.find((l) => l === rawLevel);
    if (found) logLevel = found;
    else warnings.push('VITE_LOG_LEVEL invalid; using info');
  }

  let maxFlashesPerSecond = DEFAULT_CONFIG.maxFlashesPerSecond;
  const rawFlashes = env.VITE_MAX_FLASHES_PER_SECOND;
  if (rawFlashes !== undefined) {
    const n = typeof rawFlashes === 'string' ? Number(rawFlashes) : NaN;
    if (Number.isFinite(n)) {
      // Never above 3: the safety ceiling is not configurable upwards.
      maxFlashesPerSecond = Math.min(3, Math.max(1, n));
      if (n !== maxFlashesPerSecond) warnings.push('VITE_MAX_FLASHES_PER_SECOND clamped to 1..3');
    } else {
      warnings.push('VITE_MAX_FLASHES_PER_SECOND invalid; using 3');
    }
  }

  return { config: { logLevel, maxFlashesPerSecond }, warnings };
}

export function loadConfig(): ParsedConfig {
  return parseConfig(import.meta.env);
}
