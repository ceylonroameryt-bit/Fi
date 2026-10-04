import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { appLogger } from '../common/logging/app-logger';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  /** Action link contained in the mail (verification / reset / invitation). */
  link?: string;
}

/**
 * Mail delivery boundary. This phase ships a development transport that logs
 * messages (and keeps an in-memory outbox in test mode). A real provider
 * (SES, Postmark, …) can be added by replacing `deliver` without touching callers.
 */
@Injectable()
export class MailService {
  private readonly outbox: OutgoingMail[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppEnv) {}

  async send(mail: OutgoingMail): Promise<void> {
    if (this.config.isTest) {
      this.outbox.push(mail);
      return;
    }
    if (this.config.isProduction) {
      appLogger.event('warn', 'mail_transport_not_configured', { to: mail.to, subject: mail.subject });
      return;
    }
    // Development only: print the action link so flows can be completed locally.
    appLogger.event('info', 'dev_mail', { to: mail.to, subject: mail.subject, link: mail.link });
  }

  /** Test helper: most recent mail sent to an address. */
  lastMailTo(address: string): OutgoingMail | undefined {
    return [...this.outbox].reverse().find((m) => m.to === address);
  }
}
