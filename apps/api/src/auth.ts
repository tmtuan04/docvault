import { authSchema } from '@document-saas/db';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';

import { db } from './database.js';
import { env } from './config/env.js';

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
      sendVerificationOTP({ email, otp, type }) {
        if (env.OTP_DELIVERY !== 'console') {
          throw new Error(
            'Email OTP provider is not configured for the selected delivery mode.',
          );
        }

        // Development-only delivery. Replace with Resend/SES before production.
        console.info(`[DocVault OTP] ${type} code for ${email}: ${otp}`);
        return Promise.resolve();
      },
    }),
  ],
});

export type Auth = typeof auth;
