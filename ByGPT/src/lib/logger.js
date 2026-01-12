export function createRunLogger({ debugEnabled = false } = {}) {
  const logs = [];

  function push(level, message, meta) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      message: String(message),
      ...(meta ? { meta } : {})
    };
    logs.push(entry);

    const prefix = level.toUpperCase().padEnd(5);
    if (meta) {
      // eslint-disable-next-line no-console
      console.log(`[${prefix}] ${entry.ts} ${entry.message}`, meta);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[${prefix}] ${entry.ts} ${entry.message}`);
    }
  }

  return {
    logs,
    info: (msg, meta) => push("info", msg, meta),
    warn: (msg, meta) => push("warn", msg, meta),
    error: (msg, meta) => push("error", msg, meta),
    debug: (msg, meta) => {
      if (debugEnabled) push("debug", msg, meta);
    }
  };
}
