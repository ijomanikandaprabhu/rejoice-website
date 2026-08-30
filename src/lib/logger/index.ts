type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} (${scope}) ${message}`;
  if (level === 'error') console.error(line, meta ?? '');
  else if (level === 'warn') console.warn(line, meta ?? '');
  else console.log(line, meta ?? '');
}

/** Tiny scoped logger. Used by the sync service so failures are traceable (section 36). */
export function createLogger(scope: string) {
  return {
    debug: (m: string, meta?: unknown) =>
      process.env.NODE_ENV === 'development' && emit('debug', scope, m, meta),
    info: (m: string, meta?: unknown) => emit('info', scope, m, meta),
    warn: (m: string, meta?: unknown) => emit('warn', scope, m, meta),
    error: (m: string, meta?: unknown) => emit('error', scope, m, meta),
  };
}
