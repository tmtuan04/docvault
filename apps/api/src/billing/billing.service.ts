import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type DatabaseTransaction,
  and,
  desc,
  eq,
  memberships,
  payments,
  subscriptions,
  tenants,
  withBillingWebhookTransaction,
  withTenantTransaction,
} from '@document-saas/db';
import {
  BILLING_PERIOD_DAYS,
  PAID_PLANS,
  PAYMENT_REFERENCE_PREFIX,
  type PaidPlan,
} from '@document-saas/shared';
import { randomBytes } from 'node:crypto';

import { env } from '../config/env.js';
import { db } from '../database.js';
import { type SepayWebhookPayload } from './billing.dto.js';
import { EntitlementService } from './entitlement.service.js';
import { QuotaService } from './quota.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_ROLES = new Set(['owner', 'admin']);
const PENDING_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000;

function generateReferenceCode(): string {
  // Bank transfer notes are normalized aggressively; keep it short,
  // uppercase and alphanumeric so it survives every banking app.
  return `${PAYMENT_REFERENCE_PREFIX}${randomBytes(5).toString('hex').toUpperCase()}`;
}

function buildQrImageUrl(input: { amountVnd: number; reference: string }) {
  if (!env.SEPAY_BANK_ACCOUNT || !env.SEPAY_BANK_CODE) {
    return null;
  }

  const params = new URLSearchParams({
    acc: env.SEPAY_BANK_ACCOUNT,
    bank: env.SEPAY_BANK_CODE,
    amount: String(input.amountVnd),
    des: input.reference,
  });

  return `https://qr.sepay.vn/img?${params.toString()}`;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly entitlement: EntitlementService,
    private readonly quota: QuotaService,
  ) {}

  async overview(tenantId: string, userId: string) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireMember(tx, tenantId, userId);

      const summary = await this.entitlement.summarize(tx, tenantId);
      const usage = await this.quota.summarize(tx, tenantId, summary);
      const history = await tx
        .select({
          id: payments.id,
          plan: payments.plan,
          amountVnd: payments.amountVnd,
          referenceCode: payments.referenceCode,
          status: payments.status,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.tenantId, tenantId))
        .orderBy(desc(payments.createdAt))
        .limit(20);

      return {
        entitlement: summary,
        usage,
        plans: Object.entries(PAID_PLANS).map(([id, plan]) => ({
          id,
          label: plan.label,
          amountVnd: plan.amountVnd,
          periodDays: BILLING_PERIOD_DAYS,
        })),
        payments: history,
      };
    });
  }

  async createCheckout(tenantId: string, userId: string, plan: PaidPlan) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireAdmin(tx, tenantId, userId);

      // Reuse a still-pending recent payment for the same plan so refreshing
      // the dialog does not create a pile of open payment intents.
      const [existing] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.plan, plan),
            eq(payments.status, 'pending'),
          ),
        )
        .orderBy(desc(payments.createdAt))
        .limit(1);

      const paymentRow =
        existing &&
        existing.createdAt.getTime() > Date.now() - PENDING_PAYMENT_TTL_MS
          ? existing
          : undefined;

      const payment =
        paymentRow ??
        (
          await tx
            .insert(payments)
            .values({
              tenantId,
              plan,
              amountVnd: PAID_PLANS[plan].amountVnd,
              referenceCode: generateReferenceCode(),
              createdBy: userId,
            })
            .returning()
        )[0];

      if (!payment) {
        throw new Error('Failed to create payment');
      }

      return {
        paymentId: payment.id,
        plan: payment.plan,
        amountVnd: payment.amountVnd,
        referenceCode: payment.referenceCode,
        status: payment.status,
        qrImageUrl: buildQrImageUrl({
          amountVnd: payment.amountVnd,
          reference: payment.referenceCode,
        }),
        bank: {
          code: env.SEPAY_BANK_CODE || null,
          account: env.SEPAY_BANK_ACCOUNT || null,
          accountName: env.SEPAY_ACCOUNT_NAME || null,
        },
      };
    });
  }

  /**
   * SePay posts every incoming bank transaction. The transfer note contains
   * our reference code; look the payment up through the webhook RLS context,
   * then activate the subscription inside the tenant context. Idempotent:
   * a payment already marked paid is acknowledged without side effects.
   */
  async handleSepayWebhook(apiKeyHeader: string, payload: SepayWebhookPayload) {
    this.verifyApiKey(apiKeyHeader);

    if (payload.transferType && payload.transferType !== 'in') {
      return { success: true, ignored: 'outgoing transfer' };
    }

    const note = `${payload.content ?? ''} ${payload.description ?? ''}`;
    const reference = this.extractReference(note);

    if (!reference) {
      this.logger.warn(`SePay webhook without reference code: "${note}"`);
      return { success: true, ignored: 'no reference code' };
    }

    const payment = await withBillingWebhookTransaction(
      db,
      reference,
      async (tx) => {
        const [row] = await tx
          .select()
          .from(payments)
          .where(eq(payments.referenceCode, reference))
          .limit(1);
        return row;
      },
    );

    if (!payment) {
      this.logger.warn(`SePay webhook for unknown reference ${reference}`);
      return { success: true, ignored: 'unknown reference' };
    }

    if (payment.status === 'paid') {
      return { success: true, ignored: 'already paid' };
    }

    const amount = payload.transferAmount ?? 0;
    if (amount < payment.amountVnd) {
      throw new BadRequestException(
        `Transfer amount ${amount} is less than expected ${payment.amountVnd}`,
      );
    }

    await withTenantTransaction(db, payment.tenantId, async (tx) => {
      await tx
        .update(payments)
        .set({
          status: 'paid',
          paidAt: new Date(),
          providerTransactionId:
            payload.id !== undefined ? String(payload.id) : null,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      await this.activateSubscription(tx, payment.tenantId, payment.plan);
    });

    this.logger.log(
      `Payment ${payment.referenceCode} confirmed; tenant ${payment.tenantId} → ${payment.plan}`,
    );

    return { success: true };
  }

  private async activateSubscription(
    tx: DatabaseTransaction,
    tenantId: string,
    plan: (typeof payments.$inferSelect)['plan'],
  ) {
    const now = new Date();
    const periodMs = BILLING_PERIOD_DAYS * DAY_MS;

    const [existing] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    if (existing) {
      // Paying before the current period ends extends it; after expiry the
      // new period starts from now.
      const base =
        existing.status === 'active' && existing.currentPeriodEnd > now
          ? existing.currentPeriodEnd
          : now;

      await tx
        .update(subscriptions)
        .set({
          plan,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(base.getTime() + periodMs),
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id));
    } else {
      await tx.insert(subscriptions).values({
        tenantId,
        plan,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + periodMs),
      });
    }

    await tx
      .update(tenants)
      .set({ plan, status: 'active', updatedAt: now })
      .where(eq(tenants.id, tenantId));
  }

  private verifyApiKey(header: string) {
    const expected = env.SEPAY_WEBHOOK_API_KEY;

    if (!expected) {
      if (env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Webhook API key is not configured');
      }
      return;
    }

    // SePay sends "Authorization: Apikey <key>".
    const provided = header.replace(/^Apikey\s+/i, '').trim();
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid webhook API key');
    }
  }

  private extractReference(note: string): string | null {
    const match = note
      .toUpperCase()
      .match(new RegExp(`${PAYMENT_REFERENCE_PREFIX}[A-F0-9]{10}`));
    return match?.[0] ?? null;
  }

  private async requireMember(
    tx: DatabaseTransaction,
    tenantId: string,
    userId: string,
  ) {
    const [membership] = await tx
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)),
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    return membership;
  }

  private async requireAdmin(
    tx: DatabaseTransaction,
    tenantId: string,
    userId: string,
  ) {
    const membership = await this.requireMember(tx, tenantId, userId);

    if (!ADMIN_ROLES.has(membership.role)) {
      throw new ForbiddenException('Owner or admin role required');
    }

    return membership;
  }
}
