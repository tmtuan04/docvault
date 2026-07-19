import {
  and,
  documentChunks,
  documents,
  eq,
  withTenantTransaction,
} from '@document-saas/db';
import type { IngestJobData } from '@document-saas/shared';

import { embedTexts } from './ai.js';
import { db } from './database.js';
import { chunkText, extractText } from './extract.js';
import { downloadObject } from './storage.js';

export async function processIngestJob(job: IngestJobData): Promise<void> {
  const buffer = await downloadObject(job.storageKey);
  const text = await extractText(buffer, job.mimeType);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    await withTenantTransaction(db, job.tenantId, async (tx) => {
      await tx
        .update(documents)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(
          and(
            eq(documents.tenantId, job.tenantId),
            eq(documents.id, job.documentId),
          ),
        );
    });
    throw new Error(`No extractable text found in ${job.fileName}`);
  }

  const embeddings = await embedTexts(chunks);

  await withTenantTransaction(db, job.tenantId, async (tx) => {
    await tx
      .delete(documentChunks)
      .where(
        and(
          eq(documentChunks.tenantId, job.tenantId),
          eq(documentChunks.documentVersionId, job.documentVersionId),
        ),
      );

    await tx.insert(documentChunks).values(
      chunks.map((content, chunkIndex) => ({
        tenantId: job.tenantId,
        documentId: job.documentId,
        documentVersionId: job.documentVersionId,
        chunkIndex,
        content,
        embedding: embeddings[chunkIndex],
        tokenCount: Math.ceil(content.length / 4),
        metadata: {
          fileName: job.fileName,
          mimeType: job.mimeType,
        },
      })),
    );

    await tx
      .update(documents)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(
        and(
          eq(documents.tenantId, job.tenantId),
          eq(documents.id, job.documentId),
        ),
      );
  });
}

export async function markDocumentFailed(job: IngestJobData): Promise<void> {
  await withTenantTransaction(db, job.tenantId, async (tx) => {
    await tx
      .update(documents)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(
        and(
          eq(documents.tenantId, job.tenantId),
          eq(documents.id, job.documentId),
        ),
      );
  });
}
