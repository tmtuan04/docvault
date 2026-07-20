import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  type DatabaseTransaction,
  eq,
  subscriptions,
  tenants,
} from '@document-saas/db';

export type EntitlementFeature = 'write' | 'ai';

export interface EntitlementSummary {
  plan: string;
  status: string;
  /** True while the tenant may upload documents and run AI chat. */
  isEntitled: boolean;
  reason: 'trialing' | 'subscription' | 'expired';
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

/**
 * Central plan/trial gate. Reading documents and keyword search stay open
 * after expiry (soft lock); uploads and AI chat require an active trial or a
 * paid subscription confirmed through the SePay webhook.
 */
@Injectable()
export class EntitlementService {
  async summarize(
    tx: DatabaseTransaction,
    tenantId: string,
  ): Promise<EntitlementSummary> {
    const [tenant] = await tx
      .select({
        plan: tenants.plan,
        status: tenants.status,
        trialEndsAt: tenants.trialEndsAt,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw new HttpException('Workspace not found', HttpStatus.NOT_FOUND);
    }

    const [subscription] = await tx
      .select({
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    const now = Date.now();
    const hasActiveSubscription =
      subscription?.status === 'active' &&
      subscription.currentPeriodEnd.getTime() > now;
    const hasActiveTrial =
      tenant.status === 'trialing' &&
      tenant.trialEndsAt !== null &&
      tenant.trialEndsAt.getTime() > now;

    return {
      plan: tenant.plan,
      status: tenant.status,
      isEntitled: hasActiveSubscription || hasActiveTrial,
      reason: hasActiveSubscription
        ? 'subscription'
        : hasActiveTrial
          ? 'trialing'
          : 'expired',
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    };
  }

  async assertEntitled(
    tx: DatabaseTransaction,
    tenantId: string,
    feature: EntitlementFeature,
  ): Promise<EntitlementSummary> {
    const summary = await this.summarize(tx, tenantId);

    if (!summary.isEntitled) {
      const action = feature === 'write' ? 'tải tài liệu lên' : 'dùng AI chat';
      throw new HttpException(
        `Thời gian dùng thử đã kết thúc. Nâng cấp gói để tiếp tục ${action}.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return summary;
  }
}
