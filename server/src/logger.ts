export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * One JSON object per line on stdout/stderr — easy to ship to any log drain.
 * Callers pass metadata only; message content and secrets must never be logged.
 */
export function createLogger(minLevel: LogLevel = 'info'): Logger {
  const write = (level: LogLevel, event: string, fields: LogFields = {}) => {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
    if (level === 'error' || level === 'warn') console.error(line);
    else console.log(line);
  };
  return {
    debug: (event, fields) => write('debug', event, fields),
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}

/** Swallows everything — handy in tests. */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
