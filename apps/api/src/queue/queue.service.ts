import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { INGEST_QUEUE, type IngestJobData } from '@document-saas/shared';
import { Queue } from 'bullmq';

import { env } from '../config/env.js';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly ingestQueue = new Queue<IngestJobData>(INGEST_QUEUE, {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  enqueueIngest(data: IngestJobData) {
    return this.ingestQueue.add('ingest', data, {
      jobId: `${data.tenantId}-${data.documentVersionId}`,
    });
  }

  async onModuleDestroy() {
    await this.ingestQueue.close();
  }
}
