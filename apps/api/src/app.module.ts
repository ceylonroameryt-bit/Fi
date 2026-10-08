import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { APP_CONFIG } from './config/config.module';
import type { AppEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrganizationAccessGuard } from './common/guards/organization-access.guard';
import { OrganizationMembersModule } from './organization-members/organization-members.module';
import { RolesModule } from './roles/roles.module';
import { AccountsModule } from './accounts/accounts.module';
import { FinancialYearsModule } from './financial-years/financial-years.module';
import { AccountingEngineModule } from './accounting-engine/accounting-engine.module';
import { JournalsModule } from './journals/journals.module';
import { LedgerModule } from './ledger/ledger.module';
import { ReportsModule } from './reports/reports.module';
import { ContactsModule } from './contacts/contacts.module';
import { InvoicesModule } from './invoices/invoices.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './common/storage/storage.module';
import { AiModule } from './ai/ai.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [APP_CONFIG],
      useFactory: (config: AppEnv) => [
        {
          ttl: 60000,
          limit: config.RATE_LIMIT_PER_MINUTE,
        },
      ],
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    OrganizationMembersModule,
    RolesModule,
    AccountsModule,
    FinancialYearsModule,
    AccountingEngineModule,
    JournalsModule,
    LedgerModule,
    ReportsModule,
    ContactsModule,
    InvoicesModule,
    AdminModule,
    HealthModule,
    StorageModule,
    AiModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationAccessGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
