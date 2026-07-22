import Link from 'next/link';

import { PricingCards } from '@/components/marketing/pricing-cards';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--color-muted),transparent_38%)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          DocVault
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className={buttonVariants({ variant: 'ghost' })}>
            Trang chủ
          </Link>
          <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
            Đăng nhập
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Bảng giá đơn giản, minh bạch
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Bắt đầu với 14 ngày dùng thử Team miễn phí. Thanh toán bằng QR chuyển
          khoản qua SePay, không cần thẻ tín dụng.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <PricingCards ctaLabel="Dùng thử 14 ngày" />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24 text-center text-sm text-muted-foreground">
        <p>
          Giá đã bao gồm VAT khi xuất hóa đơn (tính năng hóa đơn điện tử sẽ có
          trong bản Growth). Gia hạn trước hạn được cộng dồn vào cuối chu kỳ
          hiện tại.
        </p>
        <Link
          href="/login"
          className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}
        >
          Tạo workspace miễn phí
        </Link>
      </section>
    </main>
  );
}
