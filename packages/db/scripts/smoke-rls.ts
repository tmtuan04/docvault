/**
 * End-to-end smoke test for PostgreSQL tenant isolation.
 *
 * The admin connection seeds and cleans fixtures because it may bypass RLS.
 * Assertions use the non-superuser runtime connection, matching API/worker
 * behavior in production.
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { eq, inArray } from 'drizzle-orm';

import {
  createDatabase,
  documents,
  memberships,
  tags,
  tenants,
  users,
  withTenantTransaction,
  withUserTransaction,
} from '../src/index.js';

loadEnv({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const adminUrl = process.env.DATABASE_ADMIN_URL;
const runtimeUrl = process.env.DATABASE_URL;

if (!adminUrl || !runtimeUrl) {
  throw new Error('DATABASE_ADMIN_URL and DATABASE_URL are required');
}

// One connection per role is enough and keeps this short-lived test predictable.
const admin = createDatabase(adminUrl, { max: 1 });
const runtime = createDatabase(runtimeUrl, { max: 1 });

const tenantA = randomUUID();
const tenantB = randomUUID();
const userId = randomUUID();
const suffix = randomUUID();

try {
  // Arrange: seed two tenants with one document each through the admin role.
  await admin.db.insert(users).values({
    id: userId,
    email: `rls-${suffix}@example.test`,
    name: 'RLS smoke test',
  });

  await admin.db.insert(tenants).values([
    { id: tenantA, name: 'RLS Tenant A', slug: `rls-a-${suffix}` },
    { id: tenantB, name: 'RLS Tenant B', slug: `rls-b-${suffix}` },
  ]);

  await admin.db.insert(documents).values([
    {
      tenantId: tenantA,
      createdBy: userId,
      name: 'tenant-a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      status: 'ready',
    },
    {
      tenantId: tenantB,
      createdBy: userId,
      name: 'tenant-b.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 200,
      status: 'ready',
    },
  ]);

  await admin.db.insert(memberships).values([
    { tenantId: tenantA, userId, role: 'owner' },
    { tenantId: tenantB, userId, role: 'member' },
  ]);

  // No tenant context must reveal no tenant-owned rows.
  const withoutContext = await runtime.db
    .select({ name: documents.name })
    .from(documents);

  // Each context must see exactly its own document.
  const visibleToA = await withTenantTransaction(
    runtime.db,
    tenantA,
    async (tx) => tx.select({ name: documents.name }).from(documents),
  );

  const visibleToB = await withTenantTransaction(
    runtime.db,
    tenantB,
    async (tx) => tx.select({ name: documents.name }).from(documents),
  );

  const userMemberships = await withUserTransaction(
    runtime.db,
    userId,
    async (tx) =>
      tx
        .select({ tenantId: memberships.tenantId })
        .from(memberships)
        .where(eq(memberships.userId, userId)),
  );

  // A valid tenant-A transaction still cannot write a tenant-B row.
  let crossTenantWriteBlocked = false;
  try {
    await withTenantTransaction(runtime.db, tenantA, async (tx) => {
      await tx.insert(tags).values({
        tenantId: tenantB,
        name: 'must-be-blocked',
      });
    });
  } catch {
    crossTenantWriteBlocked = true;
  }

  // Assert both read isolation and write protection in one deterministic check.
  const passed =
    withoutContext.length === 0 &&
    visibleToA.length === 1 &&
    visibleToA[0]?.name === 'tenant-a.pdf' &&
    visibleToB.length === 1 &&
    visibleToB[0]?.name === 'tenant-b.pdf' &&
    userMemberships.length === 2 &&
    crossTenantWriteBlocked;

  if (!passed) {
    throw new Error(
      `RLS failed: no-context=${withoutContext.length}, tenant-a=${JSON.stringify(
        visibleToA,
      )}, tenant-b=${JSON.stringify(visibleToB)}, memberships=${userMemberships.length}, blocked=${crossTenantWriteBlocked}`,
    );
  }

  console.log(
    'RLS smoke test passed: reads isolated and cross-tenant write blocked.',
  );
} finally {
  // Cleanup always runs, including after an assertion or connection failure.
  await admin.db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB]));
  await admin.db.delete(users).where(eq(users.id, userId));
  await Promise.all([admin.close(), runtime.close()]);
}
