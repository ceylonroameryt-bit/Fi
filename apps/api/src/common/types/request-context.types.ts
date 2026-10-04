import type { Request } from 'express';
import type { SystemRoleKey } from '@prisma/client';

/** Identity attached by the authentication guard. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  email: string;
}

/** Organisation access context attached by the organisation access guard. */
export interface OrgContext {
  organizationId: string;
  memberId: string;
  roleId: string;
  roleName: string;
  systemRoleKey: SystemRoleKey | null;
  permissions: ReadonlySet<string>;
  baseCurrency: string;
}

/** Who performed an action, used for audit records. */
export interface Actor {
  userId: string | null;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface AppRequest extends Request {
  requestId?: string;
  auth?: AuthContext;
  org?: OrgContext;
}
