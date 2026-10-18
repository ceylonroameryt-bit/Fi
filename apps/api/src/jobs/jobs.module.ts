import { Global, Module } from '@nestjs/common';
import { JobQueueService } from './job-queue.service';
import { JobWorkerService } from './job-worker.service';

/** Background work queue shared by all modules; handlers register with JobWorkerService. */
@Global()
@Module({
  providers: [JobQueueService, JobWorkerService],
  exports: [JobQueueService, JobWorkerService],
})
export class JobsModule {}
