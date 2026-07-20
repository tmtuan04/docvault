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

/** Paid plans purchasable through SePay QR transfer (VND per 30 days). */
export const PAID_PLANS = {
  pro: { label: 'Pro', amountVnd: 149_000 },
  team: { label: 'Team', amountVnd: 499_000 },
} as const;

export type PaidPlan = keyof typeof PAID_PLANS;

export const BILLING_PERIOD_DAYS = 30;

/** Prefix of the bank-transfer note that SePay webhooks are matched by. */
export const PAYMENT_REFERENCE_PREFIX = 'DVT';

export function isPaidPlan(plan: string): plan is PaidPlan {
  return plan in PAID_PLANS;
}
