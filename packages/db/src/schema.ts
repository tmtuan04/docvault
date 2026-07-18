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
    displayName: varchar('display_name', { length: 255 }),
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

// Drizzle derives read/insert TypeScript shapes directly from the schema.
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
