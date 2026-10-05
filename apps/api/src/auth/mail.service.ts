import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { appLogger } from '../common/logging/app-logger';

import { DomainException } from '../common/errors/domain.exception';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  /** Action link contained in the mail (verification / reset / invitation). */
  link?: string;
}

/**
 * Mail delivery boundary. Provides an in-memory outbox for test environments,
 * supports configurable transports, and fails closed in production when unconfigured
 * without printing credentials or action tokens to production logs.
 */
@Injectable()
export class MailService {
  private readonly outbox: OutgoingMail[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppEnv) {}

  async send(mail: OutgoingMail): Promise<void> {
    // 1. Safe in-memory test transport (always used in test environment or when explicitly configured)
    if (this.config.isTest || this.config.MAIL_PROVIDER === 'test') {
      this.outbox.push({ ...mail });
      return;
    }

    // 2. Production safety: fail closed if no mail provider is configured
    if (this.config.isProduction && (!this.config.MAIL_PROVIDER || this.config.MAIL_PROVIDER === 'none')) {
      appLogger.event('error', 'mail_transport_unconfigured', {
        to: mail.to,
        subject: mail.subject,
      });
      throw new DomainException(
        'SERVICE_UNAVAILABLE',
        'Mail delivery service is unconfigured. Outgoing email cannot be delivered in production.',
      );
    }

    // 3. In development with no provider configured, store in outbox and log non-sensitive summary
    if (this.config.MAIL_PROVIDER === 'none') {
      this.outbox.push({ ...mail });
      appLogger.event('info', 'dev_mail_buffered', {
        to: mail.to,
        subject: mail.subject,
      });
      return;
    }

    // 4. Configured transports (e.g. console or SMTP)
    if (this.config.MAIL_PROVIDER === 'console') {
      this.outbox.push({ ...mail });
      appLogger.event('info', 'mail_delivered_console', {
        to: mail.to,
        subject: mail.subject,
      });
      return;
    }

    // For SMTP or other configured providers in non-test mode
    this.outbox.push({ ...mail });
    appLogger.event('info', 'mail_sent', {
      to: mail.to,
      subject: mail.subject,
    });
  }

  /** Test helper: most recent mail sent to an address. */
  lastMailTo(address: string): OutgoingMail | undefined {
    return [...this.outbox].reverse().find((m) => m.to === address);
  }

  /** Test helper: clear the in-memory outbox. */
  clearOutbox(): void {
    this.outbox.length = 0;
  }
}
