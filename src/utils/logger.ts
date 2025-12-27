import pino from 'pino';
import { getConfig } from '../config/index.js';

let loggerInstance: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (!loggerInstance) {
    const config = getConfig();
    loggerInstance = pino({
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }
  return loggerInstance;
}

export function createChildLogger(name: string): pino.Logger {
  return getLogger().child({ component: name });
}

export function resetLogger(): void {
  loggerInstance = null;
}
