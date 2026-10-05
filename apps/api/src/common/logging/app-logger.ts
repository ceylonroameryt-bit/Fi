import { LoggerService } from '@nestjs/common';
import { currentRequestContext } from '../context/request-context';

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|hash|credential|api_?key|private|cert/i;

function redactString(str: string): string {
  // Redact token/secret/code query parameters from URLs or strings
  let out = str.replace(/([?&](token|code|secret|apiKey|password)=)[^&\s]+/gi, '$1[REDACTED]');
  // Redact raw JWT tokens
  out = out.replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT_REDACTED]');
  return out;
}

/** Removes values of sensitive-looking keys so they never reach log storage. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

/**
 * Structured JSON logger. Every line includes the request correlation id
 * (when inside a request) so log lines can be joined across services.
 */
export class AppLogger implements LoggerService {
  private readonly minLevel: number;

  constructor(level: Level = 'info') {
    this.minLevel = LEVEL_ORDER[level];
  }

  log(message: unknown, ...optional: unknown[]): void {
    this.write('info', message, optional);
  }
  error(message: unknown, ...optional: unknown[]): void {
    this.write('error', message, optional);
  }
  warn(message: unknown, ...optional: unknown[]): void {
    this.write('warn', message, optional);
  }
  debug(message: unknown, ...optional: unknown[]): void {
    this.write('debug', message, optional);
  }
  verbose(message: unknown, ...optional: unknown[]): void {
    this.write('debug', message, optional);
  }

  /** Structured event logging with arbitrary (redacted) fields. */
  event(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;
    const ctx = currentRequestContext();
    const line = {
      time: new Date().toISOString(),
      level,
      msg,
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      ...(redact(fields) as Record<string, unknown>),
    };
    const out = JSON.stringify(line);
    if (level === 'error' || level === 'warn') process.stderr.write(out + '\n');
    else process.stdout.write(out + '\n');
  }

  private write(level: Level, message: unknown, optional: unknown[]): void {
    // Nest passes the context name as the last string argument.
    const context = typeof optional[optional.length - 1] === 'string' ? (optional.pop() as string) : undefined;
    const fields: Record<string, unknown> = { context };
    if (message instanceof Error) {
      fields.error = { name: message.name, message: message.message, stack: message.stack };
      this.event(level, message.message, fields);
      return;
    }
    if (optional.length > 0) fields.details = optional;
    this.event(level, typeof message === 'string' ? message : JSON.stringify(redact(message)), fields);
  }
}

export const appLogger = new AppLogger((process.env.LOG_LEVEL as Level | undefined) ?? 'info');
