const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'http://localhost:3001';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'team' | 'business';
  status: 'trialing' | 'active' | 'past_due' | 'suspended';
  role: 'owner' | 'admin' | 'member' | 'viewer';
  trial: {
    endsAt: string | null;
    daysRemaining: number;
    isExpired: boolean;
  };
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  folderId: string | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPreview {
  documentId: string;
  name: string;
  mimeType: string;
  downloadUrl: string;
}

export interface SearchResult {
  documentId: string;
  documentName: string;
  mimeType: string;
  status: string;
  chunkId: string;
  chunkIndex: number;
  snippet: string;
}

export interface ChatCitation {
  documentId: string;
  documentName: string;
  chunkId: string;
  chunkIndex: number;
  snippet: string;
  score: number;
}

export interface BillingOverview {
  entitlement: {
    plan: string;
    status: string;
    isEntitled: boolean;
    reason: 'trialing' | 'subscription' | 'expired';
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  };
  usage: {
    plan: string;
    limits: {
      storageBytes: number;
      seats: number;
      aiQueriesPerMonth: number;
    };
    usage: {
      storageBytes: number;
      seats: number;
      aiQueries: number;
      period: string;
    };
    remaining: {
      storageBytes: number;
      seats: number;
      aiQueries: number;
    };
  };
  plans: Array<{
    id: string;
    label: string;
    amountVnd: number;
    periodDays: number;
  }>;
  payments: Array<{
    id: string;
    plan: string;
    amountVnd: number;
    referenceCode: string;
    status: 'pending' | 'paid' | 'failed' | 'expired';
    paidAt: string | null;
    createdAt: string;
  }>;
}

export interface CheckoutIntent {
  paymentId: string;
  plan: string;
  amountVnd: number;
  referenceCode: string;
  status: string;
  qrImageUrl: string | null;
  bank: {
    code: string | null;
    account: string | null;
    accountName: string | null;
  };
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined && init.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;

    throw new Error(message ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function uploadDocumentFile(input: {
  tenantId: string;
  file: File;
}): Promise<DocumentItem> {
  const mimeType = guessMimeType(input.file);
  const prepared = await apiFetch<{
    document: DocumentItem;
    version: { id: string };
    uploadUrl: string;
    headers: Record<string, string>;
  }>(`/api/workspaces/${input.tenantId}/documents/upload-url`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: input.file.name,
      mimeType,
      sizeBytes: input.file.size,
    }),
  });

  const uploadResponse = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    headers: prepared.headers,
    body: input.file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload to storage failed (${uploadResponse.status})`);
  }

  const checksumBuffer = await input.file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', checksumBuffer);
  const checksum = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return apiFetch<DocumentItem>(
    `/api/workspaces/${input.tenantId}/documents/complete`,
    {
      method: 'POST',
      body: JSON.stringify({
        documentId: prepared.document.id,
        documentVersionId: prepared.version.id,
        checksum,
      }),
    },
  );
}

function guessMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return 'text/markdown';
  }
  return 'text/plain';
}
