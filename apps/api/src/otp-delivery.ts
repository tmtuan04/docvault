import { Resend } from 'resend';

import { env } from './config/env.js';

type OtpType =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'change-email';

function subjectFor(type: OtpType): string {
  switch (type) {
    case 'sign-in':
      return 'Your DocVault sign-in code';
    case 'email-verification':
      return 'Verify your DocVault email';
    case 'forget-password':
      return 'Reset your DocVault password';
    case 'change-email':
      return 'Confirm your DocVault email change';
  }
}

function htmlBody(otp: string, type: OtpType): string {
  const purpose =
    type === 'sign-in'
      ? 'sign in'
      : type === 'email-verification'
        ? 'verify your email'
        : type === 'change-email'
          ? 'confirm your email change'
          : 'reset your password';

  return `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
      <p>Use this code to ${purpose} to DocVault:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em;">${otp}</p>
      <p style="color: #555;">This code expires in 10 minutes. If you did not request it, ignore this email.</p>
    </div>
  `.trim();
}

export async function sendOtpEmail(input: {
  email: string;
  otp: string;
  type: OtpType;
}): Promise<void> {
  if (env.OTP_DELIVERY === 'console') {
    console.info(
      `[DocVault OTP] ${input.type} code for ${input.email}: ${input.otp}`,
    );
    return;
  }

  if (env.OTP_DELIVERY === 'resend') {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required when OTP_DELIVERY=resend');
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.OTP_FROM,
      to: input.email,
      subject: subjectFor(input.type),
      html: htmlBody(input.otp, input.type),
      text: `Your DocVault code is ${input.otp}. It expires in 10 minutes.`,
    });

    if (error) {
      throw new Error(`Resend OTP failed: ${error.message}`);
    }

    return;
  }

  throw new Error(
    `Unsupported OTP_DELIVERY="${env.OTP_DELIVERY}". Use console or resend.`,
  );
}
