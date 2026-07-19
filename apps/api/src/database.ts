import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabase } from '@document-saas/db';

import { env } from './config/env.js';

/**
 * Shared runtime connection. It uses `docvault_app`, never the migration
 * superuser, so tenant RLS remains effective for API requests.
 */
export const databaseClient = createDatabase(env.DATABASE_URL);
export const db = databaseClient.db;

@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await databaseClient.close();
  }
}
