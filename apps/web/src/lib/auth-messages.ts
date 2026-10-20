/**
 * Plain-language messages for auth errors: say what happened and what to do next,
 * never blame, and never reveal whether an account exists.
 */

interface ErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

const MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'That email and password don’t match. Check for typos, or reset your password.',
  AUTH_ACCOUNT_LOCKED:
    'Sign-in is paused for a few minutes to protect your account. Try again shortly, or reset your password.',
  AUTH_ACCOUNT_DISABLED: 'This account has been switched off. Ask your company’s owner or contact support.',
  AUTH_EMAIL_IN_USE: 'There’s already an account with this email. Sign in instead, or reset your password.',
  AUTH_TOKEN_INVALID: 'This link has expired or has already been used. Request a new one below.',
  AUTH_INVALID_TOKEN: 'This link has expired or has already been used. Request a new one below.',
  AUTH_MFA_INVALID_CODE:
    'That code didn’t work. Codes change every 30 seconds — try the newest one, and check your phone’s time is set automatically.',
  AUTH_SESSION_EXPIRED: 'Your session ended. Please sign in again.',
};

export function friendlyAuthError(
  err: unknown,
  fallback = 'Something went wrong. Nothing was changed — please try again.',
): string {
  const e = (err ?? {}) as ErrorLike;
  if (e.code && MESSAGES[e.code]) return MESSAGES[e.code];
  if (e.code === 'AUTH_WEAK_PASSWORD' && e.message)
    return e.message.endsWith('.') ? e.message : `${e.message}.`;
  if (e.status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (e.status && e.status >= 500)
    return 'We couldn’t reach Blynt just now. Your data is safe — try again in a moment.';
  if (e.message && e.code === 'VALIDATION_FAILED') return e.message;
  if (err instanceof TypeError) return 'You seem to be offline. Check your connection and try again.';
  return e.message && e.code ? e.message : fallback;
}
