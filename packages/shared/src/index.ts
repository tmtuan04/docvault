export const APP_NAME = 'Document SaaS';

export type TenantId = string;

/** BullMQ queue that processes uploaded documents into searchable chunks. */
export const INGEST_QUEUE = 'document-ingest';

export interface IngestJobData {
  tenantId: string;
  documentId: string;
  documentVersionId: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
}

export const EMBEDDING_DIMENSIONS = 1536;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isAllowedUploadMimeType(
  mimeType: string,
): mimeType is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);
}
