/**
 * PostgreSQL client factory and the safe entry point for tenant-scoped queries.
 */
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Options, type Sql } from 'postgres';

import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export interface DatabaseClient {
  // Typed Drizzle query builder used by repositories/services.
  db: Database;
  // Low-level postgres.js client retained for shutdown and advanced operations.
  client: Sql;
  close: () => Promise<void>;
}

/**
 * Creates a DB client without reading process.env implicitly.
 *
 * Callers must choose the correct connection string: DATABASE_URL for normal
 * runtime work and DATABASE_ADMIN_URL only for migration tooling.
 */
export function createDatabase(
  connectionString: string,
  options: Options<Record<string, never>> = {},
): DatabaseClient {
  const client = postgres(connectionString, {
    // Prepared statements can conflict with transaction-pooling proxies.
    prepare: false,
    ...options,
  });
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    close: () => client.end(),
  };
}

/**
 * Runs all tenant-scoped work in one transaction.
 *
 * The third set_config argument (`true`) is equivalent to SET LOCAL: the value
 * exists only for this transaction. A pooled connection therefore cannot leak
 * tenant A's context into a later request for tenant B.
 *
 * RLS policies read `app.tenant_id` and transparently reject rows belonging to
 * other tenants, even when application code forgets a WHERE tenant_id clause.
 */
export async function withTenantTransaction<T>(
  db: Database,
  tenantId: string,
  callback: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.tenant_id', ${tenantId}, true)`,
    );
    return callback(tx);
  });
}

/**
 * Runs identity-scoped work such as listing all workspaces for one user.
 *
 * Unlike tenant-scoped queries, this context deliberately exposes only rows
 * connected to `app.user_id` through dedicated SELECT policies.
 */
export async function withUserTransaction<T>(
  db: Database,
  userId: string,
  callback: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return callback(tx);
  });
}

/**
 * Payment-webhook context: the provider only sends a transfer note, so the
 * tenant is unknown until the matching payment row is found. A dedicated RLS
 * policy exposes exactly the `payments` row whose reference code equals
 * `app.billing_ref` — nothing else becomes readable.
 */
export async function withBillingWebhookTransaction<T>(
  db: Database,
  referenceCode: string,
  callback: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.billing_ref', ${referenceCode}, true)`,
    );
    return callback(tx);
  });
}
