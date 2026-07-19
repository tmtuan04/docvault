'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, Mail } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

function loginDestination() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session.data) {
      router.replace(loginDestination());
    }
  }, [router, session.data]);

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    });

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Không thể gửi mã OTP');
      return;
    }

    setStep('otp');
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await authClient.signIn.emailOtp({
      email,
      otp,
      name: name.trim() || email.split('@')[0],
    });

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Mã OTP không hợp lệ');
      return;
    }

    router.replace(loginDestination());
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Về trang chủ
        </Link>

        <Card>
          <CardHeader>
            <div className="mb-3 grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Mail className="size-5" />
            </div>
            <CardTitle className="text-xl">Đăng nhập DocVault</CardTitle>
            <CardDescription>
              {step === 'email'
                ? 'Nhập email để nhận mã đăng nhập một lần.'
                : `Nhập mã 6 số đã gửi tới ${email}.`}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Không thể đăng nhập</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {step === 'email' ? (
              <form onSubmit={sendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên hiển thị</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nguyễn Văn An"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ban@congty.vn"
                    autoComplete="email"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  Gửi mã OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Mã OTP</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, ''))
                    }
                    placeholder="000000"
                    className="text-center font-mono text-lg tracking-[0.4em]"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || otp.length !== 6}
                >
                  {isSubmitting ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  Xác nhận và đăng nhập
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setOtp('');
                    setError('');
                    setStep('email');
                  }}
                >
                  Đổi email
                </Button>
              </form>
            )}

            <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
              Trong môi trường local, mã OTP được in tại terminal chạy API.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
