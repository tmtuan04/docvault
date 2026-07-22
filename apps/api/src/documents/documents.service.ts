import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type DatabaseTransaction,
  and,
  desc,
  documents,
  documentVersions,
  eq,
  isNull,
  memberships,
  withTenantTransaction,
} from '@document-saas/db';
import { createHash, randomUUID } from 'node:crypto';

import { QueueService } from '../queue/queue.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EntitlementService } from '../billing/entitlement.service.js';
import { QuotaService } from '../billing/quota.service.js';
import { db } from '../database.js';
import { CompleteUploadDto, CreateUploadUrlDto } from './document.dto.js';

const WRITE_ROLES = new Set(['owner', 'admin', 'member']);

/** Display name: keep Unicode (Vietnamese) letters, strip control/path chars. */
function sanitizeFileName(fileName: string): string {
  return (
    fileName
      .replace(/[\p{C}/\\]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'document'
  );
}

/** Storage key segment: ASCII-only so every S3-compatible backend is happy. */
function toStorageFileName(fileName: string): string {
  const ascii = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .replace(/[^\w.\- ()[\]]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  return ascii || 'document';
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly entitlement: EntitlementService,
    private readonly quota: QuotaService,
  ) {}

  async list(tenantId: string, userId: string) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireMember(tx, tenantId, userId);

      return tx
        .select({
          id: documents.id,
          name: documents.name,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          status: documents.status,
          folderId: documents.folderId,
          currentVersion: documents.currentVersion,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(
          and(eq(documents.tenantId, tenantId), isNull(documents.deletedAt)),
        )
        .orderBy(desc(documents.createdAt));
    });
  }

  async createUploadUrl(
    tenantId: string,
    userId: string,
    input: CreateUploadUrlDto,
  ) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireWriter(tx, tenantId, userId);
      const entitlement = await this.entitlement.assertEntitled(
        tx,
        tenantId,
        'write',
      );
      await this.quota.assertStorage(
        tx,
        tenantId,
        entitlement,
        input.sizeBytes,
      );

      const documentId = randomUUID();
      const versionId = randomUUID();
      const displayName = sanitizeFileName(input.fileName);
      const storageKey = `tenants/${tenantId}/documents/${documentId}/v1/${toStorageFileName(input.fileName)}`;

      const [document] = await tx
        .insert(documents)
        .values({
          id: documentId,
          tenantId,
          folderId: input.folderId,
          createdBy: userId,
          name: displayName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          status: 'uploading',
          currentVersion: 1,
        })
        .returning({
          id: documents.id,
          name: documents.name,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          status: documents.status,
        });

      const [version] = await tx
        .insert(documentVersions)
        .values({
          id: versionId,
          tenantId,
          documentId,
          uploadedBy: userId,
          versionNumber: 1,
          storageKey,
          checksum: createHash('sha256').update(storageKey).digest('hex'),
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        })
        .returning({
          id: documentVersions.id,
          storageKey: documentVersions.storageKey,
          versionNumber: documentVersions.versionNumber,
        });

      if (!document || !version) {
        throw new Error('Failed to create document upload records');
      }

      const uploadUrl = await this.storage.createUploadUrl({
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      });

      return {
        document,
        version,
        uploadUrl,
        headers: {
          'Content-Type': input.mimeType,
        },
      };
    });
  }

  async completeUpload(
    tenantId: string,
    userId: string,
    input: CompleteUploadDto,
  ) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireWriter(tx, tenantId, userId);
      await this.entitlement.assertEntitled(tx, tenantId, 'write');

      const [document] = await tx
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, tenantId),
            eq(documents.id, input.documentId),
            isNull(documents.deletedAt),
          ),
        )
        .limit(1);

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      if (document.status !== 'uploading' && document.status !== 'failed') {
        throw new BadRequestException('Document is not awaiting upload');
      }

      const [version] = await tx
        .select()
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.tenantId, tenantId),
            eq(documentVersions.id, input.documentVersionId),
            eq(documentVersions.documentId, input.documentId),
          ),
        )
        .limit(1);

      if (!version) {
        throw new NotFoundException('Document version not found');
      }

      await tx
        .update(documentVersions)
        .set({ checksum: input.checksum })
        .where(eq(documentVersions.id, version.id));

      const [updated] = await tx
        .update(documents)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(documents.id, document.id))
        .returning({
          id: documents.id,
          name: documents.name,
          status: documents.status,
        });

      await this.queue.enqueueIngest({
        tenantId,
        documentId: document.id,
        documentVersionId: version.id,
        storageKey: version.storageKey,
        mimeType: version.mimeType,
        fileName: document.name,
      });

      return updated;
    });
  }

  async getDownloadUrl(tenantId: string, userId: string, documentId: string) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireMember(tx, tenantId, userId);

      const [document] = await tx
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, tenantId),
            eq(documents.id, documentId),
            isNull(documents.deletedAt),
          ),
        )
        .limit(1);

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      const [version] = await tx
        .select()
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.tenantId, tenantId),
            eq(documentVersions.documentId, documentId),
            eq(documentVersions.versionNumber, document.currentVersion),
          ),
        )
        .limit(1);

      if (!version) {
        throw new NotFoundException('Document version not found');
      }

      const downloadUrl = await this.storage.createDownloadUrl(
        version.storageKey,
        document.name,
      );

      return {
        documentId: document.id,
        name: document.name,
        mimeType: document.mimeType,
        downloadUrl,
      };
    });
  }

  async softDelete(tenantId: string, userId: string, documentId: string) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireWriter(tx, tenantId, userId);

      const [deleted] = await tx
        .update(documents)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(documents.tenantId, tenantId),
            eq(documents.id, documentId),
            isNull(documents.deletedAt),
          ),
        )
        .returning({ id: documents.id });

      if (!deleted) {
        throw new NotFoundException('Document not found');
      }

      return { success: true };
    });
  }

  private async requireMember(
    tx: DatabaseTransaction,
    tenantId: string,
    userId: string,
  ) {
    const [membership] = await tx
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)),
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    return membership;
  }

  private async requireWriter(
    tx: DatabaseTransaction,
    tenantId: string,
    userId: string,
  ) {
    const membership = await this.requireMember(tx, tenantId, userId);

    if (!WRITE_ROLES.has(membership.role)) {
      throw new ForbiddenException('Write access required');
    }

    return membership;
  }
}
