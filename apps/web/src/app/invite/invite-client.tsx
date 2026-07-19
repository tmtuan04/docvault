'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

export function InviteClient({
  tenantId,
  token,
}: {
  tenantId: string;
  token: string;
}) {
  const router = useRouter();
  const session = authClient.useSession();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('Đang xác nhận lời mời...');

  useEffect(() => {
    if (session.isPending) return;

    if (!session.data) {
      const next = `/invite?tenant=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    let cancelled = false;
    apiFetch<{ success: boolean }>(
      `/api/workspaces/${tenantId}/invitations/${token}/accept`,
      { method: 'POST' },
    )
      .then(() => {
        if (cancelled) return;
        setStatus('success');
        setMessage('Bạn đã tham gia workspace thành công.');
        window.localStorage.setItem('docvault-workspace', tenantId);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          cause instanceof Error
            ? cause.message
            : 'Không thể chấp nhận lời mời',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [router, session.data, session.isPending, tenantId, token]);

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-muted">
            {status === 'loading' ? (
              <LoaderCircle className="size-6 animate-spin" />
            ) : status === 'success' ? (
              <CheckCircle2 className="size-6 text-emerald-600" />
            ) : (
              <XCircle className="size-6 text-destructive" />
            )}
          </div>
          <CardTitle>Lời mời workspace</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'error' ? (
            <Alert variant="destructive" className="mb-4 text-left">
              <AlertTitle>Không thể tham gia</AlertTitle>
              <AlertDescription>
                Kiểm tra email đăng nhập hoặc yêu cầu lời mời mới.
              </AlertDescription>
            </Alert>
          ) : null}
          {status !== 'loading' ? (
            <Button onClick={() => router.replace('/dashboard')}>
              Mở dashboard
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
