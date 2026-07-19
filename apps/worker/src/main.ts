import { INGEST_QUEUE, type IngestJobData } from '@document-saas/shared';
import { Worker } from 'bullmq';

import { env } from './config/env.js';
import { databaseClient } from './database.js';
import { markDocumentFailed, processIngestJob } from './ingest.js';

function bootstrap() {
  const worker = new Worker<IngestJobData>(
    INGEST_QUEUE,
    async (job) => {
      console.info(
        `[ingest] start ${job.data.fileName} (${job.data.documentId})`,
      );
      await processIngestJob(job.data);
      console.info(`[ingest] ready ${job.data.documentId}`);
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 2,
    },
  );

  worker.on('failed', (job, error) => {
    console.error(
      `[ingest] failed ${job?.data.documentId ?? 'unknown'}:`,
      error,
    );
    if (job?.data) {
      void markDocumentFailed(job.data).catch((cause: unknown) => {
        console.error('[ingest] unable to mark document failed', cause);
      });
    }
  });

  const shutdown = async () => {
    console.info('[worker] shutting down');
    await worker.close();
    await databaseClient.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  console.info(
    `[worker] listening on queue ${INGEST_QUEUE} (AI_PROVIDER=${env.AI_PROVIDER})`,
  );
}

bootstrap();
