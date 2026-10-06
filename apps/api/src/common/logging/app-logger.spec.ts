import { redact } from './app-logger';

describe('AppLogger Redaction & Log Hygiene', () => {
  it('redacts sensitive keys in objects', () => {
    const data = {
      email: 'user@example.com',
      password: 'SuperSecretPassword123!',
      token: 'jwt.token.string',
      refreshTokenHash: 'hash-abc',
      cookie: 'session=123',
      apiKey: 'key-xyz',
      nested: {
        secret: 'nested-secret',
        visible: 'ok',
      },
    };

    const redacted = redact(data) as any;
    expect(redacted.email).toBe('user@example.com');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.refreshTokenHash).toBe('[REDACTED]');
    expect(redacted.cookie).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.nested.secret).toBe('[REDACTED]');
    expect(redacted.nested.visible).toBe('ok');
  });

  it('redacts action tokens and secrets inside query string URLs', () => {
    const url = 'https://app.blynt.com/reset-password?token=secretActionToken456&email=user@example.com';
    const redacted = redact(url);
    expect(redacted).toBe('https://app.blynt.com/reset-password?token=[REDACTED]&email=user@example.com');
  });

  it('redacts JWT format strings', () => {
    const rawJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const redacted = redact(`Bearer ${rawJwt}`);
    expect(redacted).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect(redacted).toBe('Bearer [JWT_REDACTED]');
  });
});
