import { IsIn } from 'class-validator';
import { PAID_PLANS } from '@document-saas/shared';

export class CreateCheckoutDto {
  @IsIn(Object.keys(PAID_PLANS))
  plan!: keyof typeof PAID_PLANS;
}

/**
 * Subset of the SePay webhook payload that billing needs.
 * https://docs.sepay.vn — SePay posts every incoming bank transaction.
 */
export interface SepayWebhookPayload {
  id?: number | string;
  transferType?: string;
  transferAmount?: number;
  content?: string;
  description?: string;
  referenceCode?: string;
}
