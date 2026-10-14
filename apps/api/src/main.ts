import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config/config.module';
import type { AppEnv } from './config/env';
import { appLogger } from './common/logging/app-logger';
import { createValidationPipe } from './common/validation/validation.pipe';
import { RolesService } from './roles/roles.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
  });

  const config = app.get<AppEnv>(APP_CONFIG);

  const isProduction = config.APP_ENV === 'production';

  // Parse CORS allowlist strictly from environment
  const originsFromCorsVar = config.CORS_ALLOWED_ORIGINS
    ? config.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
    : [];
  const originsFromFrontendVar = config.FRONTEND_URL
    ? config.FRONTEND_URL.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
    : [];

  const devOrigins = isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  // Exact-match allowlist only. Wildcards such as *.awsapprunner.com would trust every
  // other AWS customer's App Runner app, and credentials are allowed on these requests.
  const allowedOrigins = new Set(
    [...originsFromCorsVar, ...originsFromFrontendVar, ...devOrigins].filter(
      (o) => !isProduction || o.startsWith('https://'),
    ),
  );

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Requests without an Origin header (server-to-server, health checks, curl) carry no
      // browser credentials from another site, so CORS does not apply to them.
      if (!origin) return callback(null, true);
      return callback(null, allowedOrigins.has(origin.replace(/\/$/, '')));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-organization-id', 'x-csrf-token'],
    exposedHeaders: ['x-request-id', 'x-csrf-token'],
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Behind App Runner (and the Next.js proxy) the socket address is the proxy's, not the user's.
  app.getHttpAdapter().getInstance().set('trust proxy', parseTrustProxy(config.TRUST_PROXY));

  app.use(cookieParser(config.SESSION_SECRET));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  // Seed system permissions in the database at boot
  const rolesService = app.get(RolesService);
  await rolesService.seedGlobalPermissions();

  await app.listen(config.PORT);
  appLogger.event('info', 'api_started', {
    port: config.PORT,
    env: config.APP_ENV,
    url: `http://localhost:${config.PORT}/api/v1`,
  });
}

function parseTrustProxy(value: string): boolean | number | string[] {
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'false' || v === '0') return false;
  if (v === 'true') return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

bootstrap().catch((err) => {
  appLogger.event('error', 'bootstrap_failed', { error: err });
  process.exit(1);
});
