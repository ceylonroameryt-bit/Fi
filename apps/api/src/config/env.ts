import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

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
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    FRONTEND_URL: z.string().default('http://localhost:3000'),
    COOKIE_SECURE: booleanString,
    REDIS_URL: z.string().optional().default(''),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_SECRET === env.SESSION_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SESSION_SECRET'], message: 'must differ from JWT_SECRET' });
    }
    if (env.APP_ENV === 'production' && /replace-with/i.test(env.JWT_SECRET + env.SESSION_SECRET)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'placeholder secrets are not allowed in production' });
    }
  });

export type AppEnv = z.infer<typeof envSchema> & { isProduction: boolean; isTest: boolean; cookieSecure: boolean };

/**
 * Validates process.env once at boot. Fails fast with a readable message that
 * names the offending variables but never prints their values.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  const isProduction = env.APP_ENV === 'production';
  return {
    ...env,
    isProduction,
    isTest: env.APP_ENV === 'test',
    cookieSecure: isProduction || env.COOKIE_SECURE,
  };
}
