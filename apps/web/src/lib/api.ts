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

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
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

  return response.json() as Promise<T>;
}
