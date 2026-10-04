import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
  userId?: string;
  sessionId?: string;
  organizationId?: string;
}

/** Per-request context propagated through async calls (used for log correlation). */
export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function currentRequestContext(): RequestContextStore | undefined {
  return requestContext.getStore();
}
