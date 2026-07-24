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

// 25MB 
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

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

/** Hard limits per plan. Trial workspaces use Team limits. */
export const PLAN_LIMITS = {
  free: {
    label: 'Free',
    storageBytes: 1 * 1024 * 1024 * 1024,
    seats: 1,
    aiQueriesPerMonth: 20,
    priceVnd: 0,
  },
  pro: {
    label: 'Pro',
    storageBytes: 50 * 1024 * 1024 * 1024,
    seats: 1,
    aiQueriesPerMonth: 300,
    priceVnd: PAID_PLANS.pro.amountVnd,
  },
  team: {
    label: 'Team',
    storageBytes: 200 * 1024 * 1024 * 1024,
    seats: 10,
    aiQueriesPerMonth: 1500,
    priceVnd: PAID_PLANS.team.amountVnd,
  },
  business: {
    label: 'Business',
    storageBytes: 1024 * 1024 * 1024 * 1024,
    seats: 999,
    aiQueriesPerMonth: 10_000,
    priceVnd: null,
  },
} as const;

export type TenantPlan = keyof typeof PLAN_LIMITS;

/** All sellable/display plans for the pricing page. */
export const PRICING_PLANS = [
  {
    id: 'free' as const,
    highlight: false,
    features: [
      '1 GB lưu trữ',
      '1 thành viên',
      '20 lượt AI chat / tháng',
      'Tìm kiếm từ khóa',
    ],
  },
  {
    id: 'pro' as const,
    highlight: false,
    features: [
      '50 GB lưu trữ',
      '1 thành viên',
      '300 lượt AI chat / tháng',
      'Upload PDF, DOCX, TXT',
      'RAG chat có trích dẫn',
    ],
  },
  {
    id: 'team' as const,
    highlight: true,
    features: [
      '200 GB lưu trữ',
      '10 thành viên',
      '1.500 lượt AI chat / tháng',
      'Mời thành viên + phân quyền',
      '14 ngày dùng thử miễn phí',
    ],
  },
  {
    id: 'business' as const,
    highlight: false,
    features: [
      '1 TB+ lưu trữ',
      'Không giới hạn thành viên',
      '10.000+ lượt AI chat / tháng',
      'SSO, SLA, hỗ trợ riêng',
      'Liên hệ báo giá',
    ],
  },
] as const;

export function getPlanLimits(plan: string) {
  if (plan in PLAN_LIMITS) {
    return PLAN_LIMITS[plan as TenantPlan];
  }
  return PLAN_LIMITS.free;
}

export function currentUsagePeriod(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
