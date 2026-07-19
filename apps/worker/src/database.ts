import { createDatabase } from '@document-saas/db';

import { env } from './config/env.js';

export const databaseClient = createDatabase(env.DATABASE_URL);
export const db = databaseClient.db;
