/**
 * Mirrors the server's password policy (apps/api/src/auth/password.service.ts → assertStrong)
 * so people see the rules as a live checklist instead of an error after submitting.
 * The server remains the authority; this is UX only.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordRule {
  id: 'length' | 'letter' | 'number' | 'email';
  label: string;
  met: boolean;
}

export function passwordRules(password: string, email?: string): PasswordRule[] {
  const local = email?.split('@')[0]?.toLowerCase() ?? '';
  const rules: PasswordRule[] = [
    {
      id: 'length',
      label: `${PASSWORD_MIN_LENGTH}+ characters`,
      met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    { id: 'letter', label: 'a letter', met: /[A-Za-z]/.test(password) },
    { id: 'number', label: 'a number', met: /[0-9]/.test(password) },
  ];
  if (local.length >= 4) {
    rules.push({
      id: 'email',
      label: 'not your email name',
      met: password.length > 0 && !password.toLowerCase().includes(local),
    });
  }
  return rules;
}

export function passwordAcceptable(password: string, email?: string): boolean {
  return passwordRules(password, email).every((r) => r.met);
}

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/** 0 = empty, 1 = weak … 4 = strong. Length and variety beyond the minimum raise the score. */
export function passwordStrength(password: string, email?: string): PasswordStrength {
  if (!password) return 0;
  if (!passwordAcceptable(password, email)) return 1;
  let score = 2;
  if (password.length >= 14) score++;
  if (/[^A-Za-z0-9]/.test(password) && /[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  return Math.min(score, 4) as PasswordStrength;
}

export const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  0: '',
  1: 'Too weak',
  2: 'Good',
  3: 'Strong',
  4: 'Very strong',
};
