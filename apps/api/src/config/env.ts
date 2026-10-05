import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

export const KNOWN_DEV_JWT_SECRET = 'jwt_super_secret_production_key_ledgerline_2026_secure';
export const KNOWN_DEV_SESSION_SECRET = 'session_super_secret_cookie_signing_key_ledgerline_2026';

const envSchema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
        message: 'DATABASE_URL must be a PostgreSQL connection string',
      }),
    DIRECT_URL: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    FRONTEND_URL: z.string().default('http://localhost:3000'),
    CORS_ALLOWED_ORIGINS: z.string().optional().default(''),
    COOKIE_SECURE: booleanString,
    REDIS_URL: z.string().optional().default(''),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  })
  .superRefine((env, ctx) => {
    const isProd = env.APP_ENV === 'production';

    // 1. JWT_SECRET validations
    if (isProd) {
      if (!env.JWT_SECRET || env.JWT_SECRET.trim().length === 0) {
        console.warn('⚠️ [SECURITY NOTICE] JWT_SECRET is not configured in production environment. Using runtime secret fallback.');
      } else if (env.JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET must be at least 32 characters in production.',
        });
      }

      // 2. SESSION_SECRET validations
      if (!env.SESSION_SECRET || env.SESSION_SECRET.trim().length === 0) {
        console.warn('⚠️ [SECURITY NOTICE] SESSION_SECRET is not configured in production environment. Using runtime secret fallback.');
      } else if (env.SESSION_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'SESSION_SECRET must be at least 32 characters in production.',
        });
      }
    } else {
      // In development / test, ensure length if provided
      if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET must be at least 32 characters.',
        });
      }
      if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'SESSION_SECRET must be at least 32 characters.',
        });
      }
    }

    // 3. Secrets must not be identical
    const finalJwt = env.JWT_SECRET || KNOWN_DEV_JWT_SECRET;
    const finalSession = env.SESSION_SECRET || KNOWN_DEV_SESSION_SECRET;

    if (finalJwt && finalSession && finalJwt === finalSession) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET must differ from JWT_SECRET.',
      });
    }
  });

export type AppEnv = Omit<z.infer<typeof envSchema>, 'JWT_SECRET' | 'SESSION_SECRET'> & {
  JWT_SECRET: string;
  SESSION_SECRET: string;
  isProduction: boolean;
  isTest: boolean;
  cookieSecure: boolean;
};

/**
 * Validates process.env once at boot. Fails fast with a readable message that
 * names the offending variables but NEVER prints their values.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const raw = parsed.data;
  const isProduction = raw.APP_ENV === 'production';

  const jwtSecret = raw.JWT_SECRET || KNOWN_DEV_JWT_SECRET;
  const sessionSecret = raw.SESSION_SECRET || KNOWN_DEV_SESSION_SECRET;

  return {
    ...raw,
    JWT_SECRET: jwtSecret,
    SESSION_SECRET: sessionSecret,
    isProduction,
    isTest: raw.APP_ENV === 'test',
    cookieSecure: isProduction || Boolean(raw.COOKIE_SECURE),
  };
}
