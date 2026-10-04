import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { appLogger } from '../logging/app-logger';
import { DomainException, ErrorCode } from './domain.exception';

export interface ErrorBody {
  error: {
    code: ErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

const HTTP_CODE_MAP: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'AUTH_REQUIRED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

/** Maps a known Prisma error to a safe, structured API error (never leaking SQL). */
function fromPrisma(error: Prisma.PrismaClientKnownRequestError): { status: number; code: ErrorCode; message: string } {
  switch (error.code) {
    case 'P2002':
      return { status: 409, code: 'CONFLICT', message: 'A record with the same unique value already exists' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'The requested record was not found' };
    case 'P2003':
      return { status: 409, code: 'CONFLICT', message: 'The operation conflicts with related records' };
    case 'P2034':
      return { status: 409, code: 'CONCURRENT_MODIFICATION', message: 'The record was modified concurrently, please retry' };
    default:
      return { status: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
  }
}

/**
 * Single place translating every thrown error into the API error envelope:
 *   { error: { code, message, details?, requestId } }
 * Unexpected errors are logged with stack traces server-side but only a
 * generic message is returned to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId;

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof DomainException) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'RATE_LIMITED';
      message = 'Too many requests, please slow down';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      code = HTTP_CODE_MAP[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR');
      if (typeof response === 'object' && response !== null) {
        const r = response as { message?: unknown; code?: string; details?: Record<string, unknown> };
        if (r.code) code = r.code;
        if (r.details) details = r.details;
        message = typeof r.message === 'string' ? r.message : exception.message;
      } else {
        message = String(response);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = fromPrisma(exception);
      status = mapped.status;
      code = mapped.code;
      message = mapped.message;
      appLogger.event('warn', 'prisma_error', { prismaCode: exception.code, meta: exception.meta, error: exception.message });
      if (status >= 500) appLogger.event('error', 'prisma_error', { prismaCode: exception.code, error: exception.message });
    } else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      appLogger.event('error', 'unhandled_exception', {
        error: { name: err.name, message: err.message, stack: err.stack },
        path: req.originalUrl?.split('?')[0],
      });
    }

    const body: ErrorBody = { error: { code, message, ...(details ? { details } : {}), requestId } };
    res.status(status).json(body);
  }
}
