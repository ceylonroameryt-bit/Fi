import { loadEnv, KNOWN_DEV_JWT_SECRET, KNOWN_DEV_SESSION_SECRET } from './env';

describe('Environment Configuration & Security Hardening (env.ts)', () => {
  const baseDevEnv = {
    APP_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  };

  const strongSecret1 = 'a-very-strong-production-jwt-secret-with-more-than-32-chars-long';
  const strongSecret2 = 'a-different-strong-session-secret-with-more-than-32-chars-long';

  it('allows development defaults when not in production', () => {
    const env = loadEnv(baseDevEnv);
    expect(env.APP_ENV).toBe('development');
    expect(env.isProduction).toBe(false);
    expect(env.JWT_SECRET).toBe(KNOWN_DEV_JWT_SECRET);
    expect(env.SESSION_SECRET).toBe(KNOWN_DEV_SESSION_SECRET);
  });

  it('fails fast in production when JWT_SECRET is missing', () => {
    expect(() =>
      loadEnv({
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_SECRET: strongSecret2,
      }),
    ).toThrow(/JWT_SECRET is required in production/);
  });

  it('fails fast in production when SESSION_SECRET is missing', () => {
    expect(() =>
      loadEnv({
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: strongSecret1,
      }),
    ).toThrow(/SESSION_SECRET is required in production/);
  });

  it('fails in production when secrets are shorter than 32 characters', () => {
    expect(() =>
      loadEnv({
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'short-secret-123',
        SESSION_SECRET: strongSecret2,
      }),
    ).toThrow(/JWT_SECRET must be at least 32 characters/);
  });

  it('fails in production when secrets use known development or placeholder values', () => {
    expect(() =>
      loadEnv({
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: KNOWN_DEV_JWT_SECRET,
        SESSION_SECRET: strongSecret2,
      }),
    ).toThrow(/JWT_SECRET cannot use a known development, example, or placeholder/);
  });

  it('fails in production when JWT_SECRET and SESSION_SECRET are identical', () => {
    expect(() =>
      loadEnv({
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: strongSecret1,
        SESSION_SECRET: strongSecret1,
      }),
    ).toThrow(/SESSION_SECRET must differ from JWT_SECRET/);
  });

  it('consistently detects production via NODE_ENV=production even if APP_ENV is unset', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      }),
    ).toThrow(/JWT_SECRET is required in production/);
  });

  it('successfully starts in production with strong, distinct, custom secrets', () => {
    const env = loadEnv({
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: strongSecret1,
      SESSION_SECRET: strongSecret2,
    });
    expect(env.isProduction).toBe(true);
    expect(env.JWT_SECRET).toBe(strongSecret1);
    expect(env.SESSION_SECRET).toBe(strongSecret2);
  });
});
