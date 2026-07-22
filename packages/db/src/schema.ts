/**
 * Drizzle schema for the MVP database.
 *
 * `users` is global identity data. Every business table is tenant-scoped by a
 * `tenant_id` column so PostgreSQL RLS can isolate workspaces without relying
 * only on application-level WHERE clauses.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';

// Shared audit columns for mutable entities.
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
};

// PostgreSQL enums reject invalid domain states at the database boundary.
export const tenantPlanEnum = pgEnum('tenant_plan', [
  'free',
  'pro',
  'team',
  'business',
]);

export const tenantStatusEnum = pgEnum('tenant_status', [
  'trialing',
  'active',
  'past_due',
  'suspended',
]);

export const membershipRoleEnum = pgEnum('membership_role', [
  'owner',
  'admin',
  'member',
  'viewer',
]);

export const documentStatusEnum = pgEnum('document_status', [
  'uploading',
  'processing',
  'ready',
  'failed',
]);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'revoked',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'canceled',
  'expired',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'expired',
]);

/**
 * Global user identities.
 *
 * A user can belong to multiple tenants; tenant-specific roles therefore live
 * in `memberships`, not on this table.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    // Better Auth expects these property names; SQL remains snake_case.
    name: varchar('display_name', { length: 255 }).notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_uidx').on(table.email)],
);

// A tenant is an isolated personal or company workspace.
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    plan: tenantPlanEnum('plan').default('free').notNull(),
    status: tenantStatusEnum('status').default('trialing').notNull(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('tenants_slug_uidx').on(table.slug)],
);

/**
 * Many-to-many link between users and tenants.
 * The unique constraint prevents one user receiving duplicate memberships.
 */
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    unique('memberships_tenant_user_uidx').on(table.tenantId, table.userId),
    index('memberships_user_tenant_idx').on(table.userId, table.tenantId),
    index('memberships_tenant_role_idx').on(table.tenantId, table.role),
  ],
);

/**
 * Email invitations for users who do not have a membership yet.
 * The token is shared only in the invite link and expires automatically.
 */
export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }).notNull(),
    role: membershipRoleEnum('role').default('member').notNull(),
    status: invitationStatusEnum('status').default('pending').notNull(),
    token: varchar('token', { length: 128 }).notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('workspace_invitations_token_uidx').on(table.token),
    index('workspace_invitations_tenant_email_idx').on(
      table.tenantId,
      table.email,
    ),
    index('workspace_invitations_expires_idx').on(table.expiresAt),
  ],
);

/**
 * Better Auth session records. These are global identity records rather than
 * tenant business data, so tenant RLS is not applied to auth tables.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('sessions_token_uidx').on(table.token),
    index('sessions_user_idx').on(table.userId),
  ],
);

// Provider credentials and tokens used by Better Auth.
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('accounts_user_idx').on(table.userId),
    unique('accounts_provider_account_uidx').on(
      table.providerId,
      table.accountId,
    ),
  ],
);

// Short-lived OTP and email verification values used by Better Auth.
export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

/**
 * Tenant-scoped folder tree. A null parent means the folder is at the root.
 */
export const folders = pgTable(
  'folders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    name: varchar('name', { length: 255 }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique('folders_tenant_id_uidx').on(table.tenantId, table.id),
    // Treat null parents as equal so duplicate root folder names are rejected.
    unique('folders_tenant_parent_name_uidx')
      .on(table.tenantId, table.parentId, table.name)
      .nullsNotDistinct(),
    // Including tenant_id prevents a folder from pointing to another tenant.
    foreignKey({
      columns: [table.tenantId, table.parentId],
      foreignColumns: [table.tenantId, table.id],
      name: 'folders_tenant_parent_fk',
    }).onDelete('cascade'),
    index('folders_tenant_parent_idx').on(table.tenantId, table.parentId),
    index('folders_tenant_deleted_idx').on(table.tenantId, table.deletedAt),
  ],
);

/**
 * Logical document metadata.
 *
 * Binary files are not stored in PostgreSQL. Their MinIO/R2 keys live in
 * `document_versions`, allowing one document to have multiple file versions.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 255 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: documentStatusEnum('status').default('uploading').notNull(),
    currentVersion: integer('current_version').default(1).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique('documents_tenant_id_uidx').on(table.tenantId, table.id),
    // The composite FK forbids attaching a document to another tenant's folder.
    foreignKey({
      columns: [table.tenantId, table.folderId],
      foreignColumns: [folders.tenantId, folders.id],
      name: 'documents_tenant_folder_fk',
    }).onDelete('set null'),
    index('documents_tenant_folder_idx').on(table.tenantId, table.folderId),
    index('documents_tenant_status_idx').on(table.tenantId, table.status),
    index('documents_tenant_deleted_idx').on(table.tenantId, table.deletedAt),
  ],
);

// Immutable file versions stored in MinIO locally and R2 in production.
export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    versionNumber: integer('version_number').notNull(),
    // S3 object key, for example tenants/{tenantId}/documents/{id}/v1/file.pdf.
    storageKey: text('storage_key').notNull(),
    checksum: varchar('checksum', { length: 128 }).notNull(),
    mimeType: varchar('mime_type', { length: 255 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('document_versions_tenant_id_uidx').on(table.tenantId, table.id),
    unique('document_versions_number_uidx').on(
      table.tenantId,
      table.documentId,
      table.versionNumber,
    ),
    unique('document_versions_storage_key_uidx').on(table.storageKey),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'document_versions_tenant_document_fk',
    }).onDelete('cascade'),
    index('document_versions_tenant_document_idx').on(
      table.tenantId,
      table.documentId,
    ),
  ],
);

/**
 * Extracted text chunks used by retrieval-augmented generation (RAG).
 * Embeddings are nullable while a document is waiting to be embedded.
 */
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull(),
    documentVersionId: uuid('document_version_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    // 1536 dimensions matches the initial MVP embedding model contract.
    embedding: vector('embedding', { dimensions: 1536 }),
    metadata: jsonb('metadata')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    tokenCount: integer('token_count'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('document_chunks_tenant_id_uidx').on(table.tenantId, table.id),
    unique('document_chunks_version_index_uidx').on(
      table.tenantId,
      table.documentVersionId,
      table.chunkIndex,
    ),
    // Both composite FKs keep document, version and chunk in the same tenant.
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'document_chunks_tenant_document_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.documentVersionId],
      foreignColumns: [documentVersions.tenantId, documentVersions.id],
      name: 'document_chunks_tenant_version_fk',
    }).onDelete('cascade'),
    index('document_chunks_tenant_document_idx').on(
      table.tenantId,
      table.documentId,
    ),
  ],
);

// Tag names are unique inside a tenant, but may repeat across tenants.
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    color: varchar('color', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('tags_tenant_id_uidx').on(table.tenantId, table.id),
    unique('tags_tenant_name_uidx').on(table.tenantId, table.name),
  ],
);

// Tenant-safe many-to-many link between documents and tags.
export const documentTags = pgTable(
  'document_tags',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.documentId, table.tagId],
      name: 'document_tags_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'document_tags_tenant_document_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.tagId],
      foreignColumns: [tags.tenantId, tags.id],
      name: 'document_tags_tenant_tag_fk',
    }).onDelete('cascade'),
    index('document_tags_tenant_tag_idx').on(table.tenantId, table.tagId),
  ],
);

// Better Auth's Drizzle adapter resolves plural model keys from this object.
export const authSchema = {
  users,
  sessions,
  accounts,
  verifications,
};

/**
 * One row per tenant: the currently paid plan and its billing period.
 * Trials live on `tenants` directly; a subscription appears after payment.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    plan: tenantPlanEnum('plan').notNull(),
    status: subscriptionStatusEnum('status').default('active').notNull(),
    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', {
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (table) => [unique('subscriptions_tenant_uidx').on(table.tenantId)],
);

/**
 * QR bank-transfer payment intents (SePay).
 * `referenceCode` is the transfer note customers must include; the webhook
 * matches incoming bank transactions back to a row through it.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    plan: tenantPlanEnum('plan').notNull(),
    amountVnd: bigint('amount_vnd', { mode: 'number' }).notNull(),
    referenceCode: varchar('reference_code', { length: 32 }).notNull(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    provider: varchar('provider', { length: 32 }).default('sepay').notNull(),
    providerTransactionId: varchar('provider_transaction_id', { length: 128 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    unique('payments_reference_code_uidx').on(table.referenceCode),
    unique('payments_provider_tx_uidx').on(
      table.provider,
      table.providerTransactionId,
    ),
    index('payments_tenant_created_idx').on(table.tenantId, table.createdAt),
  ],
);

/**
 * Monthly AI query counter per tenant. Storage and seats are computed live
 * from documents/memberships; only AI needs a running tally.
 */
export const usageMeters = pgTable(
  'usage_meters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    period: varchar('period', { length: 7 }).notNull(),
    aiQueries: integer('ai_queries').default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    unique('usage_meters_tenant_period_uidx').on(table.tenantId, table.period),
    index('usage_meters_tenant_idx').on(table.tenantId),
  ],
);

// Drizzle derives read/insert TypeScript shapes directly from the schema.
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type NewWorkspaceInvitation = typeof workspaceInvitations.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type UsageMeter = typeof usageMeters.$inferSelect;
export type NewUsageMeter = typeof usageMeters.$inferInsert;
