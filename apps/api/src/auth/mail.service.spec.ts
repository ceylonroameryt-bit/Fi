import { MailService } from './mail.service';
import { DomainException } from '../common/errors/domain.exception';
import type { AppEnv } from '../config/env';

describe('MailService (Production Safety & Transports)', () => {
  const baseConfig: AppEnv = {
    APP_ENV: 'test',
    PORT: 4000,
    DATABASE_URL: 'postgresql://localhost:5432/db',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 14,
    FRONTEND_URL: 'http://localhost:3000',
    CORS_ALLOWED_ORIGINS: '',
    COOKIE_SECURE: false,
    REDIS_URL: '',
    LOG_LEVEL: 'info',
    RATE_LIMIT_PER_MINUTE: 300,
    AUTH_RATE_LIMIT_PER_MINUTE: 10,
    MAIL_PROVIDER: 'test',
    MAIL_FROM: 'noreply@blynt.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    JWT_SECRET: 'a'.repeat(32),
    SESSION_SECRET: 'b'.repeat(32),
    isProduction: false,
    isTest: true,
    cookieSecure: false,
    MFA_REQUIRED_FOR_PRIVILEGED_ROLES: true,
    AI_PROVIDER: 'none',
    AI_MODEL: 'claude-opus-5-5',
    AI_PROFILE_REFRESH_MINUTES: 0,
    DOCUMENT_MAX_BYTES: 20971520,
    OCR_PROVIDER: 'none',
    JOB_WORKER_ENABLED: false,
    JOB_POLL_INTERVAL_MS: 1000,
    JOB_RETRY_BASE_MS: 5000,
    JOB_RETRY_MAX_MS: 600000,
    JOB_LOCK_TIMEOUT_MS: 300000,
    DOCUMENT_JOBS_PER_ORG_PER_MINUTE: 30,
    AI_MONTHLY_COST_LIMIT_USD: 50,
  };

  it('records outgoing messages in-memory when in test mode', async () => {
    const service = new MailService(baseConfig);
    await service.send({
      to: 'user@example.com',
      subject: 'Welcome to Blynt',
      text: 'Hello, your account is ready.',
      link: 'http://localhost:3000/accept-invitation?token=test-token-123',
    });

    const mail = service.lastMailTo('user@example.com');
    expect(mail).toBeDefined();
    expect(mail?.subject).toBe('Welcome to Blynt');
    expect(mail?.link).toContain('token=test-token-123');
  });

  it('fails closed and throws SERVICE_UNAVAILABLE when in production with no configured mail provider', async () => {
    const prodConfig: AppEnv = {
      ...baseConfig,
      APP_ENV: 'production',
      isProduction: true,
      isTest: false,
      MAIL_PROVIDER: 'none',
    };

    const service = new MailService(prodConfig);

    await expect(
      service.send({
        to: 'customer@example.com',
        subject: 'Invoice Posted',
        text: 'Your invoice is ready.',
      }),
    ).rejects.toThrow(DomainException);

    await expect(
      service.send({
        to: 'customer@example.com',
        subject: 'Invoice Posted',
        text: 'Your invoice is ready.',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('buffers and records messages in test provider even in production configuration', async () => {
    const testTransportConfig: AppEnv = {
      ...baseConfig,
      APP_ENV: 'production',
      isProduction: true,
      isTest: false,
      MAIL_PROVIDER: 'test',
    };

    const service = new MailService(testTransportConfig);

    await service.send({
      to: 'audit@example.com',
      subject: 'Security Alert',
      text: 'New sign-in from unusual location.',
    });

    const last = service.lastMailTo('audit@example.com');
    expect(last).toBeDefined();
    expect(last?.subject).toBe('Security Alert');
  });
});
