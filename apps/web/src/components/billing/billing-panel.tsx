'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Crown, LoaderCircle, QrCode } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  apiFetch,
  type BillingOverview,
  type CheckoutIntent,
} from '@/lib/api';

const paymentStatusLabel: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  expired: 'Hết hạn',
};

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('vi-VN');
}

export function BillingPanel({
  tenantId,
  isAdmin,
  onError,
  onEntitlementChange,
}: {
  tenantId: string;
  isAdmin: boolean;
  onError: (message: string) => void;
  onEntitlementChange?: (isEntitled: boolean) => void;
}) {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [checkout, setCheckout] = useState<CheckoutIntent | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const entitlement = overview?.entitlement ?? null;

  useEffect(() => {
    let cancelled = false;

    apiFetch<BillingOverview>(`/api/workspaces/${tenantId}/billing`)
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        onEntitlementChange?.(data.entitlement.isEntitled);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        onError(
          cause instanceof Error ? cause.message : 'Không tải được billing',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, refreshKey, onError, onEntitlementChange]);

  // While the QR dialog is open, poll so the UI flips to paid right after
  // the SePay webhook confirms the transfer.
  useEffect(() => {
    if (!checkoutOpen) return;

    const timer = window.setInterval(() => {
      setRefreshKey((current) => current + 1);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [checkoutOpen]);

  const paidWhileOpen =
    checkoutOpen &&
    checkout !== null &&
    overview?.payments.some(
      (payment) =>
        payment.referenceCode === checkout.referenceCode &&
        payment.status === 'paid',
    );

  const startCheckout = useCallback(
    async (plan: string) => {
      setIsCreating(true);
      try {
        const intent = await apiFetch<CheckoutIntent>(
          `/api/workspaces/${tenantId}/billing/checkout`,
          {
            method: 'POST',
            body: JSON.stringify({ plan }),
          },
        );
        setCheckout(intent);
        setCheckoutOpen(true);
      } catch (cause) {
        onError(
          cause instanceof Error ? cause.message : 'Không tạo được thanh toán',
        );
      } finally {
        setIsCreating(false);
      }
    },
    [tenantId, onError],
  );

  if (!overview || !entitlement) {
    return null;
  }

  return (
    <>
      {!entitlement.isEntitled ? (
        <Alert variant="destructive">
          <AlertTitle>Thời gian dùng thử đã kết thúc</AlertTitle>
          <AlertDescription>
            Tài liệu vẫn xem và tìm kiếm được, nhưng upload và AI chat đã bị
            khóa. Nâng cấp gói bên dưới để tiếp tục.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Gói và thanh toán
            <Badge
              variant={entitlement.isEntitled ? 'secondary' : 'destructive'}
            >
              {entitlement.reason === 'subscription'
                ? `Gói ${entitlement.plan} · hết hạn ${formatDate(entitlement.currentPeriodEnd)}`
                : entitlement.reason === 'trialing'
                  ? `Dùng thử đến ${formatDate(entitlement.trialEndsAt)}`
                  : 'Hết hạn'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Thanh toán bằng QR chuyển khoản qua SePay. Gói được kích hoạt tự
            động khi hệ thống nhận được tiền.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {overview.plans.map((plan) => {
                const isCurrentPlan =
                  entitlement.reason === 'subscription' &&
                  entitlement.plan === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                      isCurrentPlan ? 'border-primary bg-muted/40' : ''
                    }`}
                  >
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Crown className="size-4 text-muted-foreground" />
                        {plan.label}
                        {isCurrentPlan ? (
                          <Badge variant="secondary">Gói hiện tại</Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatVnd(plan.amountVnd)} / {plan.periodDays} ngày
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isCurrentPlan ? 'outline' : 'default'}
                      disabled={isCreating}
                      onClick={() => {
                        void startCheckout(plan.id);
                      }}
                    >
                      {isCreating ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <QrCode />
                      )}
                      {isCurrentPlan
                        ? 'Gia hạn'
                        : entitlement.reason === 'subscription'
                          ? 'Chuyển gói'
                          : 'Nâng cấp'}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chỉ owner/admin mới có thể thanh toán nâng cấp workspace.
            </p>
          )}

          {overview.payments.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Lịch sử thanh toán
              </p>
              {overview.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      Gói {payment.plan} · {formatVnd(payment.amountVnd)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.referenceCode} · {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      payment.status === 'paid'
                        ? 'secondary'
                        : payment.status === 'pending'
                          ? 'outline'
                          : 'destructive'
                    }
                  >
                    {paymentStatusLabel[payment.status] ?? payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thanh toán gói {checkout?.plan}</DialogTitle>
            <DialogDescription>
              Quét QR bằng app ngân hàng và giữ nguyên nội dung chuyển khoản.
            </DialogDescription>
          </DialogHeader>

          {paidWhileOpen ? (
            <Alert>
              <AlertTitle>Thanh toán thành công</AlertTitle>
              <AlertDescription>
                Gói đã được kích hoạt. Bạn có thể đóng cửa sổ này.
              </AlertDescription>
            </Alert>
          ) : checkout ? (
            <div className="space-y-4">
              {checkout.qrImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={checkout.qrImageUrl}
                  alt="QR thanh toán SePay"
                  className="mx-auto size-56 rounded-lg border"
                />
              ) : (
                <Alert>
                  <AlertTitle>Chưa cấu hình tài khoản nhận tiền</AlertTitle>
                  <AlertDescription>
                    Đặt SEPAY_BANK_CODE và SEPAY_BANK_ACCOUNT trong .env để
                    hiển thị QR. Bạn vẫn có thể chuyển khoản thủ công với nội
                    dung bên dưới.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-1 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <p>
                  Số tiền:{' '}
                  <span className="font-semibold">
                    {formatVnd(checkout.amountVnd)}
                  </span>
                </p>
                <p>
                  Nội dung chuyển khoản:{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                    {checkout.referenceCode}
                  </code>
                </p>
                {checkout.bank.account ? (
                  <p className="text-muted-foreground">
                    {checkout.bank.code} · {checkout.bank.account}
                    {checkout.bank.accountName
                      ? ` · ${checkout.bank.accountName}`
                      : ''}
                  </p>
                ) : null}
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle className="size-3.5 animate-spin" />
                Đang chờ xác nhận từ ngân hàng…
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
