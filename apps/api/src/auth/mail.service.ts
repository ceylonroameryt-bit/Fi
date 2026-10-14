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

interface SmtpTransport {
  sendMail(message: { from: string; to: string; subject: string; text: string; html?: string }): Promise<unknown>;
}

/** Keeps the in-memory outbox from growing without bound in long-running dev servers. */
const OUTBOX_LIMIT = 200;

/**
 * Mail delivery boundary.
 *
 * - `test`: in-memory outbox only (used by the test suites).
 * - `none` / `console`: development only. Nothing is delivered; a non-sensitive summary is
 *   logged (never the action link, which carries a secret token).
 * - `smtp`: real delivery through nodemailer (works with Amazon SES SMTP, Postmark, etc.).
 *
 * In production, anything other than `smtp` fails closed so missing configuration is
 * noticed instead of silently dropping verification, reset and invitation emails.
 */
@Injectable()
export class MailService {
  private readonly outbox: OutgoingMail[] = [];
  private transport: SmtpTransport | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppEnv) {}

  async send(mail: OutgoingMail): Promise<void> {
    const provider = this.config.MAIL_PROVIDER;

    if (this.config.isTest || provider === 'test') {
      this.remember(mail);
      return;
    }

    if (provider === 'smtp') {
      await this.sendSmtp(mail);
      return;
    }

    if (this.config.isProduction) {
      appLogger.event('error', 'mail_transport_unconfigured', { provider, subject: mail.subject });
      throw new DomainException(
        'SERVICE_UNAVAILABLE',
        'Email delivery is not configured. Set MAIL_PROVIDER=smtp and the SMTP_* settings.',
      );
    }

    // Development: buffer locally so the developer can inspect it, never deliver.
    this.remember(mail);
    appLogger.event('info', 'dev_mail_buffered', { to: mail.to, subject: mail.subject });
  }

  /** Test helper: most recent mail sent to an address. */
  lastMailTo(address: string): OutgoingMail | undefined {
    return [...this.outbox].reverse().find((m) => m.to === address);
  }

  /** Test helper: clear the in-memory outbox. */
  clearOutbox(): void {
    this.outbox.length = 0;
  }

  private remember(mail: OutgoingMail): void {
    this.outbox.push({ ...mail });
    if (this.outbox.length > OUTBOX_LIMIT) this.outbox.splice(0, this.outbox.length - OUTBOX_LIMIT);
  }

  private async sendSmtp(mail: OutgoingMail): Promise<void> {
    const transport = await this.getTransport();
    const text = mail.link ? `${mail.text}\n\n${mail.link}\n` : mail.text;
    const html = mail.link
      ? `<p>${escapeHtml(mail.text)}</p><p><a href="${escapeHtml(mail.link)}">${escapeHtml(mail.link)}</a></p>`
      : `<p>${escapeHtml(mail.text)}</p>`;

    try {
      await transport.sendMail({ from: this.config.MAIL_FROM, to: mail.to, subject: mail.subject, text, html });
      appLogger.event('info', 'mail_sent', { subject: mail.subject });
    } catch (err) {
      appLogger.event('error', 'mail_send_failed', { subject: mail.subject, error: err });
      throw new DomainException('SERVICE_UNAVAILABLE', 'Email could not be sent. Please try again later.');
    }
  }

  private async getTransport(): Promise<SmtpTransport> {
    if (this.transport) return this.transport;
    if (!this.config.SMTP_HOST) {
      throw new DomainException('SERVICE_UNAVAILABLE', 'SMTP_HOST is not configured');
    }
    // Loaded lazily so environments that never send mail don't load the SMTP stack.
    const nodemailer = await import('nodemailer');
    this.transport = nodemailer.createTransport({
      host: this.config.SMTP_HOST,
      port: this.config.SMTP_PORT,
      secure: Boolean(this.config.SMTP_SECURE),
      auth: this.config.SMTP_USER ? { user: this.config.SMTP_USER, pass: this.config.SMTP_PASS } : undefined,
    }) as unknown as SmtpTransport;
    return this.transport;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
