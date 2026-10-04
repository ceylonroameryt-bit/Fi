import { Global, Module } from '@nestjs/common';
import { AppEnv, loadEnv } from './env';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppEnv => loadEnv() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
