import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from '../context/request-context';
import { appLogger } from '../logging/app-logger';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,100}$/;

/**
 * Assigns a correlation id to every request (honouring a well-formed inbound
 * `x-request-id`), exposes it on the response and logs a single structured
 * access line when the response finishes. Request bodies are never logged.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.header('x-request-id');
    const requestId = inbound && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID();
    res.setHeader('x-request-id', requestId);
    (req as Request & { requestId: string }).requestId = requestId;
    const started = process.hrtime.bigint();
    const store = { requestId };

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      requestContext.run(store, () => {
        appLogger.event(res.statusCode >= 500 ? 'error' : 'info', 'http_request', {
          method: req.method,
          path: req.originalUrl.split('?')[0],
          status: res.statusCode,
          durationMs: Math.round(durationMs * 10) / 10,
        });
      });
    });

    requestContext.run(store, () => next());
  }
}
