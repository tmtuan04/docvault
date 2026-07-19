import Link from 'next/link';
import { ArrowRight, FileSearch, LockKeyhole, Sparkles } from 'lucide-react';

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
    icon: Sparkles,
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
        <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
          Đăng nhập
        </Link>
      </nav>

      <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-20 pt-20 text-center sm:pt-28">
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
            href="#features"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'min-w-40',
            )}
          >
            Xem tính năng
          </Link>
        </div>
      </section>

      <section
        id="features"
        className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3"
      >
        {features.map((feature) => (
          <Card key={feature.title} className="bg-card/80 backdrop-blur">
            <CardHeader>
              <feature.icon className="mb-3 size-5 text-muted-foreground" />
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
