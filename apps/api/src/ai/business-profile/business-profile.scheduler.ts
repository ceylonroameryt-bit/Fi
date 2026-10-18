import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { BusinessProfileService } from './business-profile.service';

/**
 * Periodic business-profile refresh (AI_PROFILE_REFRESH_MINUTES, 0 = off).
 * Interim in-process timer; Stage 6 moves this onto the job queue.
 */
@Injectable()
export class BusinessProfileScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BusinessProfileScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly profiles: BusinessProfileService,
    @Inject(APP_CONFIG) private readonly config: Pick<AppEnv, 'AI_PROFILE_REFRESH_MINUTES'>,
  ) {}

  onApplicationBootstrap(): void {
    const minutes = this.config.AI_PROFILE_REFRESH_MINUTES;
    if (!minutes) return;
    this.timer = setInterval(() => void this.tick(), minutes * 60_000);
    this.timer.unref();
    this.logger.log(`Business profile refresh every ${minutes} min`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Skips a tick if the previous run is still going. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { refreshed, failed } = await this.profiles.refreshAll();
      this.logger.log(`Business profiles refreshed: ${refreshed}, failed: ${failed}`);
    } finally {
      this.running = false;
    }
  }
}
