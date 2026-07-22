import Link from 'next/link';
import { Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PLAN_LIMITS, PRICING_PLANS } from '@document-saas/shared';
import { cn } from '@/lib/utils';

function formatVnd(amount: number | null): string {
  if (amount === null) return 'Liên hệ';
  if (amount === 0) return '0đ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatStorage(bytes: number): string {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1024) return `${(gb / 1024).toFixed(0)} TB`;
  return `${gb.toFixed(0)} GB`;
}

export function PricingCards({
  ctaHref = '/login',
  ctaLabel = 'Bắt đầu',
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PRICING_PLANS.map((item) => {
        const plan = PLAN_LIMITS[item.id];
        const isBusiness = item.id === 'business';

        return (
          <Card
            key={item.id}
            className={cn(
              'flex flex-col',
              item.highlight && 'border-primary shadow-md',
            )}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{plan.label}</CardTitle>
                {item.highlight ? <Badge>Phổ biến nhất</Badge> : null}
              </div>
              <CardDescription>
                <span className="text-2xl font-semibold text-foreground">
                  {formatVnd(plan.priceVnd)}
                </span>
                {plan.priceVnd ? (
                  <span className="text-muted-foreground"> / tháng</span>
                ) : null}
              </CardDescription>
              <p className="text-xs text-muted-foreground">
                {formatStorage(plan.storageBytes)} · {plan.seats}{' '}
                {plan.seats === 1 ? 'thành viên' : 'thành viên'} ·{' '}
                {plan.aiQueriesPerMonth.toLocaleString('vi-VN')} AI chat/tháng
              </p>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
              {item.features.map((feature) => (
                <p
                  key={feature}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {feature}
                </p>
              ))}
            </CardContent>
            <CardFooter>
              {isBusiness ? (
                <a
                  href="mailto:hello@docvault.vn"
                  className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
                >
                  Liên hệ báo giá
                </a>
              ) : (
                <Link
                  href={ctaHref}
                  className={cn(
                    buttonVariants({
                      variant: item.highlight ? 'default' : 'outline',
                    }),
                    'w-full',
                  )}
                >
                  {item.id === 'free' ? 'Dùng miễn phí' : ctaLabel}
                </Link>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
