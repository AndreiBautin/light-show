export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Scalars only — the type is what keeps user content (file names, audio) out of logs. */
export type LogFields = Readonly<Record<string, string | number | boolean>>;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createLogger(minLevel: LogLevel): Logger {
  const emit = (level: LogLevel, event: string, fields: LogFields = {}): void => {
    if (RANK[level] < RANK[minLevel]) return;
    const line = { level, event, ...fields };
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
  };
  return {
    debug: (e, f) => {
      emit('debug', e, f);
    },
    info: (e, f) => {
      emit('info', e, f);
    },
    warn: (e, f) => {
      emit('warn', e, f);
    },
    error: (e, f) => {
      emit('error', e, f);
    },
  };
}
