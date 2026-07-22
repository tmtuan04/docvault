import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  type DatabaseTransaction,
  and,
  count,
  documents,
  eq,
  isNull,
  memberships,
  sql,
  usageMeters,
} from '@document-saas/db';
import {
  PLAN_LIMITS,
  currentUsagePeriod,
  getPlanLimits,
  type TenantPlan,
} from '@document-saas/shared';

import { type EntitlementSummary } from './entitlement.service.js';

export interface UsageSummary {
  plan: TenantPlan;
  limits: {
    storageBytes: number;
    seats: number;
    aiQueriesPerMonth: number;
  };
  usage: {
    storageBytes: number;
    seats: number;
    aiQueries: number;
    period: string;
  };
  remaining: {
    storageBytes: number;
    seats: number;
    aiQueries: number;
  };
}

/**
 * Resolves which plan limits apply. Trial workspaces get Team limits even
 * before payment; paid subscriptions use the purchased plan.
 */
export function resolveQuotaPlan(entitlement: EntitlementSummary): TenantPlan {
  if (entitlement.reason === 'trialing') {
    return 'team';
  }

  if (entitlement.plan in PLAN_LIMITS) {
    return entitlement.plan as TenantPlan;
  }

  return 'free';
}

@Injectable()
export class QuotaService {
  async summarize(
    tx: DatabaseTransaction,
    tenantId: string,
    entitlement: EntitlementSummary,
  ): Promise<UsageSummary> {
    const plan = resolveQuotaPlan(entitlement);
    const limits = getPlanLimits(plan);
    const period = currentUsagePeriod();

    const [[storageRow], [seatRow], aiQueries] = await Promise.all([
      tx
        .select({
          total: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)`.mapWith(
            Number,
          ),
        })
        .from(documents)
        .where(
          and(eq(documents.tenantId, tenantId), isNull(documents.deletedAt)),
        ),
      tx
        .select({ total: count() })
        .from(memberships)
        .where(eq(memberships.tenantId, tenantId)),
      this.getAiQueryCount(tx, tenantId, period),
    ]);

    const storageBytes = storageRow?.total ?? 0;
    const seats = seatRow?.total ?? 0;

    return {
      plan,
      limits: {
        storageBytes: limits.storageBytes,
        seats: limits.seats,
        aiQueriesPerMonth: limits.aiQueriesPerMonth,
      },
      usage: {
        storageBytes,
        seats,
        aiQueries,
        period,
      },
      remaining: {
        storageBytes: Math.max(0, limits.storageBytes - storageBytes),
        seats: Math.max(0, limits.seats - seats),
        aiQueries: Math.max(0, limits.aiQueriesPerMonth - aiQueries),
      },
    };
  }

  async assertStorage(
    tx: DatabaseTransaction,
    tenantId: string,
    entitlement: EntitlementSummary,
    additionalBytes: number,
  ): Promise<UsageSummary> {
    const summary = await this.summarize(tx, tenantId, entitlement);

    if (summary.usage.storageBytes + additionalBytes > summary.limits.storageBytes) {
      const usedGb = (summary.usage.storageBytes / (1024 ** 3)).toFixed(1);
      const limitGb = (summary.limits.storageBytes / (1024 ** 3)).toFixed(0);
      throw new HttpException(
        `Đã dùng ${usedGb} GB / ${limitGb} GB. Nâng cấp gói để tăng dung lượng lưu trữ.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return summary;
  }

  async assertSeat(
    tx: DatabaseTransaction,
    tenantId: string,
    entitlement: EntitlementSummary,
  ): Promise<UsageSummary> {
    const summary = await this.summarize(tx, tenantId, entitlement);

    if (summary.usage.seats >= summary.limits.seats) {
      throw new HttpException(
        `Gói ${summary.plan} cho phép tối đa ${summary.limits.seats} thành viên. Nâng cấp để mời thêm.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return summary;
  }

  async assertAi(
    tx: DatabaseTransaction,
    tenantId: string,
    entitlement: EntitlementSummary,
  ): Promise<UsageSummary> {
    const summary = await this.summarize(tx, tenantId, entitlement);

    if (summary.usage.aiQueries >= summary.limits.aiQueriesPerMonth) {
      throw new HttpException(
        `Đã dùng hết ${summary.limits.aiQueriesPerMonth} lượt AI chat trong tháng này. Nâng cấp gói hoặc đợi tháng sau.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return summary;
  }

  async incrementAi(
    tx: DatabaseTransaction,
    tenantId: string,
    period = currentUsagePeriod(),
  ): Promise<void> {
    const [existing] = await tx
      .select({ id: usageMeters.id, aiQueries: usageMeters.aiQueries })
      .from(usageMeters)
      .where(
        and(
          eq(usageMeters.tenantId, tenantId),
          eq(usageMeters.period, period),
        ),
      )
      .limit(1);

    if (existing) {
      await tx
        .update(usageMeters)
        .set({
          aiQueries: existing.aiQueries + 1,
          updatedAt: new Date(),
        })
        .where(eq(usageMeters.id, existing.id));
      return;
    }

    await tx.insert(usageMeters).values({
      tenantId,
      period,
      aiQueries: 1,
    });
  }

  private async getAiQueryCount(
    tx: DatabaseTransaction,
    tenantId: string,
    period: string,
  ): Promise<number> {
    const [row] = await tx
      .select({ aiQueries: usageMeters.aiQueries })
      .from(usageMeters)
      .where(
        and(
          eq(usageMeters.tenantId, tenantId),
          eq(usageMeters.period, period),
        ),
      )
      .limit(1);

    return row?.aiQueries ?? 0;
  }
}
