import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

loadEnv({
  // pnpm runs workspace scripts with apps/api as the current directory.
  path: resolve(process.cwd(), '../../.env'),
  quiet: true,
});

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const otpDelivery = (process.env.OTP_DELIVERY ?? 'console') as
  | 'console'
  | 'resend';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  API_PORT: Number(process.env.API_PORT ?? 3001),
  WEB_URL: process.env.WEB_URL ?? 'http://localhost:3000',
  DATABASE_URL: required('DATABASE_URL'),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  OTP_DELIVERY: otpDelivery,
  /** From address for OTP email, e.g. DocVault <noreply@vaultdocs.cloud> */
  OTP_FROM:
    process.env.OTP_FROM ??
    process.env.SES_FROM ??
    'DocVault <onboarding@resend.dev>',
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  S3_ENDPOINT: process.env.S3_ENDPOINT || undefined,
  S3_REGION: process.env.S3_REGION ?? 'us-east-1',
  S3_BUCKET: process.env.S3_BUCKET ?? 'documents',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? '',
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === 'true',
  AI_PROVIDER: (process.env.AI_PROVIDER ?? 'mock') as 'mock' | 'openai',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_EMBEDDING_MODEL:
    process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  SEPAY_WEBHOOK_API_KEY: process.env.SEPAY_WEBHOOK_API_KEY ?? '',
  SEPAY_BANK_CODE: process.env.SEPAY_BANK_CODE ?? '',
  SEPAY_BANK_ACCOUNT: process.env.SEPAY_BANK_ACCOUNT ?? '',
  SEPAY_ACCOUNT_NAME: process.env.SEPAY_ACCOUNT_NAME ?? '',
} as const;

if (otpDelivery !== 'console' && otpDelivery !== 'resend') {
  throw new Error(
    `OTP_DELIVERY must be "console" or "resend" (got "${process.env.OTP_DELIVERY}")`,
  );
}

if (env.NODE_ENV === 'production' && env.OTP_DELIVERY === 'console') {
  throw new Error(
    'OTP_DELIVERY=console is forbidden in production; set OTP_DELIVERY=resend.',
  );
}

if (env.OTP_DELIVERY === 'resend' && !env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required when OTP_DELIVERY=resend');
}

if (env.NODE_ENV === 'production' && env.AI_PROVIDER === 'mock') {
  throw new Error(
    'AI_PROVIDER=mock is forbidden in production; configure a real provider.',
  );
}

if (env.NODE_ENV === 'production' && !env.SEPAY_WEBHOOK_API_KEY) {
  throw new Error('SEPAY_WEBHOOK_API_KEY is required in production.');
}

if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
}
