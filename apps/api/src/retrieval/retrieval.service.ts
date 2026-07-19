import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type DatabaseTransaction,
  and,
  asc,
  cosineDistance,
  documentChunks,
  documents,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  memberships,
  or,
  sql,
  withTenantTransaction,
} from '@document-saas/db';

import { answerWithContext, embedText } from '../ai/ai.js';
import { db } from '../database.js';
import { ChatDto, SearchDocumentsDto } from '../documents/document.dto.js';

/**
 * Builds a readable excerpt centered on the first match of `query`.
 * Cuts on word boundaries and adds ellipses so text never starts mid-word.
 * `isContinuation` marks chunks that follow a previous chunk (chunkIndex > 0):
 * their first word may be a fragment left over from overlap-based chunking.
 */
function buildSnippet(
  content: string,
  query: string,
  maxLength = 300,
  isContinuation = false,
): string {
  let text = content.replace(/\s+/g, ' ').trim();
  let continuedFromStart = false;

  // Old ingested data may still contain chunks starting mid-word; drop the
  // leading fragment so users never see text like "ục tiêu".
  if (isContinuation) {
    const firstSpace = text.indexOf(' ');
    if (firstSpace > 0 && firstSpace <= 20) {
      text = text.slice(firstSpace + 1);
    }
    continuedFromStart = true;
  }

  if (text.length <= maxLength) {
    return continuedFromStart ? `… ${text}` : text;
  }

  const matchAt = text.toLowerCase().indexOf(query.toLowerCase());
  let start = matchAt >= 0 ? matchAt - Math.floor(maxLength / 3) : 0;
  start = Math.max(0, Math.min(start, text.length - maxLength));

  // Snap the window to word boundaries.
  if (start > 0) {
    const boundary = text.indexOf(' ', start);
    if (boundary !== -1 && boundary < start + 40) {
      start = boundary + 1;
    }
  }

  let end = start + maxLength;
  if (end < text.length) {
    const boundary = text.lastIndexOf(' ', end);
    if (boundary > start + Math.floor(maxLength / 2)) {
      end = boundary;
    }
  } else {
    end = text.length;
  }

  const prefix = start > 0 || continuedFromStart ? '… ' : '';
  const suffix = end < text.length ? ' …' : '';

  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

@Injectable()
export class RetrievalService {
  async search(tenantId: string, userId: string, input: SearchDocumentsDto) {
    const limit = input.limit ?? 20;

    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireMember(tx, tenantId, userId);

      const pattern = `%${input.q.replace(/[%_]/g, '\\$&')}%`;
      const filters = [
        eq(documents.tenantId, tenantId),
        isNull(documents.deletedAt),
        or(
          ilike(documents.name, pattern),
          ilike(documentChunks.content, pattern),
        ),
      ];

      if (input.folderId) {
        filters.push(eq(documents.folderId, input.folderId));
      }

      const rows = await tx
        .select({
          documentId: documents.id,
          documentName: documents.name,
          mimeType: documents.mimeType,
          status: documents.status,
          chunkId: documentChunks.id,
          chunkIndex: documentChunks.chunkIndex,
          snippet: documentChunks.content,
        })
        .from(documentChunks)
        .innerJoin(
          documents,
          and(
            eq(documents.tenantId, documentChunks.tenantId),
            eq(documents.id, documentChunks.documentId),
          ),
        )
        .where(and(...filters))
        .orderBy(asc(documents.name), asc(documentChunks.chunkIndex))
        .limit(limit);

      return {
        query: input.q,
        results: rows.map((row) => ({
          ...row,
          snippet: buildSnippet(row.snippet, input.q, 300, row.chunkIndex > 0),
        })),
      };
    });
  }

  async chat(tenantId: string, userId: string, input: ChatDto) {
    const topK = input.topK ?? 6;
    const queryEmbedding = await embedText(input.message);

    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireMember(tx, tenantId, userId);

      const distance = cosineDistance(documentChunks.embedding, queryEmbedding);

      const filters = [
        eq(documentChunks.tenantId, tenantId),
        isNotNull(documentChunks.embedding),
        isNull(documents.deletedAt),
        eq(documents.status, 'ready'),
        gt(sql<number>`1 - (${distance})`, 0.15),
      ];

      if (input.folderId) {
        filters.push(eq(documents.folderId, input.folderId));
      }

      const matches = await tx
        .select({
          chunkId: documentChunks.id,
          documentId: documents.id,
          documentName: documents.name,
          chunkIndex: documentChunks.chunkIndex,
          content: documentChunks.content,
          score: sql<number>`1 - (${distance})`.mapWith(Number),
        })
        .from(documentChunks)
        .innerJoin(
          documents,
          and(
            eq(documents.tenantId, documentChunks.tenantId),
            eq(documents.id, documentChunks.documentId),
          ),
        )
        .where(and(...filters))
        .orderBy(distance)
        .limit(topK);

      const answer = await answerWithContext({
        question: input.message,
        contexts: matches.map((match) => ({
          documentName: match.documentName,
          content: match.content,
        })),
      });

      return {
        answer,
        citations: matches.map((match) => ({
          documentId: match.documentId,
          documentName: match.documentName,
          chunkId: match.chunkId,
          chunkIndex: match.chunkIndex,
          snippet: buildSnippet(
            match.content,
            input.message,
            260,
            match.chunkIndex > 0,
          ),
          score: Number(match.score.toFixed(4)),
        })),
      };
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
}
