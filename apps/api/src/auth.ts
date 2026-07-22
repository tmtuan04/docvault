import { authSchema } from '@document-saas/db';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';

import { db } from './database.js';
import { env } from './config/env.js';
import { sendOtpEmail } from './otp-delivery.js';

export const auth = betterAuth({
  appName: 'DocVault',
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_URL],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
    usePlural: true,
    transaction: true,
  }),
  advanced: {
    database: {
      generateId: 'uuid',
    },
    cookiePrefix: 'docvault',
    useSecureCookies: env.NODE_ENV === 'production',
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    emailOTP({
      expiresIn: 10 * 60,
      otpLength: 6,
      ...(env.NODE_ENV === 'test' ? { generateOTP: () => '123456' } : {}),
      async sendVerificationOTP({ email, otp, type }) {
        await sendOtpEmail({ email, otp, type });
      },
    }),
  ],
});

export type Auth = typeof auth;
