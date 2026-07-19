/**
 * Public API of `@document-saas/db`.
 *
 * Applications should import clients, tenant helpers, tables and inferred
 * model types from this file instead of reaching into internal modules.
 */
export {
  createDatabase,
  withTenantTransaction,
  withUserTransaction,
  type Database,
  type DatabaseClient,
  type DatabaseTransaction,
} from './client.js';

export * from './schema.js';

// Re-export query helpers so consumers use the same Drizzle package instance.
export {
  and,
  asc,
  cosineDistance,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
