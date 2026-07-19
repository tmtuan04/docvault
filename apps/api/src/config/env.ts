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

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  API_PORT: Number(process.env.API_PORT ?? 3001),
  WEB_URL: process.env.WEB_URL ?? 'http://localhost:3000',
  DATABASE_URL: required('DATABASE_URL'),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  OTP_DELIVERY: process.env.OTP_DELIVERY ?? 'console',
} as const;

if (env.NODE_ENV === 'production' && env.OTP_DELIVERY === 'console') {
  throw new Error(
    'OTP_DELIVERY=console is forbidden in production; configure an email provider.',
  );
}
