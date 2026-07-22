import Link from 'next/link';
import { ArrowRight, Bot, FileSearch, LockKeyhole } from 'lucide-react';

import { PricingCards } from '@/components/marketing/pricing-cards';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: FileSearch,
    title: 'Tài liệu trong một workspace',
    description:
      'Tổ chức file theo thư mục, tìm kiếm nhanh và giữ lịch sử phiên bản.',
  },
  {
    icon: Bot,
    title: 'Hỏi đáp có nguồn trích dẫn',
    description:
      'Nhận câu trả lời dựa trên đúng tài liệu của doanh nghiệp, không đoán mò.',
  },
  {
    icon: LockKeyhole,
    title: 'Cách ly dữ liệu theo tenant',
    description:
      'PostgreSQL RLS bảo vệ dữ liệu giữa các workspace ngay tại tầng database.',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--color-muted),transparent_38%)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          DocVault
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/pricing" className={buttonVariants({ variant: 'ghost' })}>
            Bảng giá
          </Link>
          <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
            Đăng nhập
          </Link>
        </div>
      </nav>

      <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-20 pt-10 text-center sm:pt-14">
        <Badge variant="secondary" className="mb-5">
          14 ngày dùng thử Team
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Tìm và hỏi đáp trên tài liệu nội bộ của bạn
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          DocVault kết hợp lưu trữ tài liệu và RAG có trích dẫn, được thiết kế
          cho đội ngũ pháp lý, kế toán, HR và SME Việt Nam.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className={cn(buttonVariants({ size: 'lg' }), 'min-w-40')}
          >
            Bắt đầu miễn phí
            <ArrowRight data-icon="inline-end" />
          </Link>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'min-w-40',
            )}
          >
            Xem bảng giá
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Bảng giá</h2>
          <p className="mt-2 text-muted-foreground">
            14 ngày dùng thử Team miễn phí. Thanh toán QR qua SePay.
          </p>
        </div>
        <PricingCards ctaLabel="Dùng thử 14 ngày" />
      </section>

      <section
        id="features"
        className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3"
      >
        {features.map((feature) => (
          <Card key={feature.title} className="bg-card/80 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <feature.icon className="size-4 shrink-0 text-muted-foreground" />
                <CardTitle className="translate-y-px leading-none">
                  {feature.title}
                </CardTitle>
              </div>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
