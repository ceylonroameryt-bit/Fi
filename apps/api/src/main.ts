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
  const allowedOrigins = Array.from(new Set([...originsFromCorsVar, ...originsFromFrontendVar, ...devOrigins]));

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server health checks)
      if (!origin) return callback(null, true);

      // In production: strict explicit allowlist only. No wildcard *.vercel.app, no localhost substring matches.
      const normalizedOrigin = origin.replace(/\/$/, '');
      const isAllowed = allowedOrigins.includes(normalizedOrigin);

      if (isAllowed) {
        return callback(null, true);
      }

      // In development/test mode only: allow localhost origins
      if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
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

bootstrap().catch((err) => {
  appLogger.event('error', 'bootstrap_failed', { error: err });
  process.exit(1);
});
