import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type DatabaseTransaction,
  and,
  desc,
  eq,
  memberships,
  tenants,
  users,
  withTenantTransaction,
  withUserTransaction,
  workspaceInvitations,
} from '@document-saas/db';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { env } from '../config/env.js';
import { EntitlementService } from '../billing/entitlement.service.js';
import { QuotaService } from '../billing/quota.service.js';
import { db } from '../database.js';
import { CreateInvitationDto, CreateWorkspaceDto } from './workspace.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_ROLES = new Set(['owner', 'admin']);

function slugify(value: string): string {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

  return `${base || 'workspace'}-${randomBytes(3).toString('hex')}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function trialSummary(trialEndsAt: Date | null) {
  if (!trialEndsAt) {
    return { endsAt: null, daysRemaining: 0, isExpired: true };
  }

  const remaining = trialEndsAt.getTime() - Date.now();

  return {
    endsAt: trialEndsAt,
    daysRemaining: Math.max(0, Math.ceil(remaining / DAY_MS)),
    isExpired: remaining <= 0,
  };
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly entitlement: EntitlementService,
    private readonly quota: QuotaService,
  ) {}

  async listForUser(userId: string) {
    return withUserTransaction(db, userId, async (tx) => {
      const rows = await tx
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          plan: tenants.plan,
          status: tenants.status,
          trialEndsAt: tenants.trialEndsAt,
          role: memberships.role,
          createdAt: tenants.createdAt,
        })
        .from(memberships)
        .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
        .where(eq(memberships.userId, userId))
        .orderBy(desc(tenants.createdAt));

      return rows.map(({ trialEndsAt, ...workspace }) => ({
        ...workspace,
        trial: trialSummary(trialEndsAt),
      }));
    });
  }

  async create(userId: string, input: CreateWorkspaceDto) {
    const tenantId = randomUUID();
    const trialEndsAt = new Date(Date.now() + 14 * DAY_MS);

    return withTenantTransaction(db, tenantId, async (tx) => {
      const [workspace] = await tx
        .insert(tenants)
        .values({
          id: tenantId,
          name: input.name,
          slug: slugify(input.name),
          plan: 'team',
          status: 'trialing',
          trialEndsAt,
        })
        .returning();

      await tx.insert(memberships).values({
        tenantId,
        userId,
        role: 'owner',
      });

      if (!workspace) {
        throw new Error('Workspace insert did not return a row');
      }

      return {
        ...workspace,
        role: 'owner' as const,
        trial: trialSummary(workspace.trialEndsAt),
      };
    });
  }

  async listMembers(tenantId: string, userId: string) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireMember(tx, tenantId, userId);

      return tx
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          role: memberships.role,
          joinedAt: memberships.joinedAt,
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(eq(memberships.tenantId, tenantId))
        .orderBy(memberships.joinedAt);
    });
  }

  async createInvitation(
    tenantId: string,
    userId: string,
    input: CreateInvitationDto,
  ) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      await this.requireAdmin(tx, tenantId, userId);
      const entitlement = await this.entitlement.summarize(tx, tenantId);
      await this.quota.assertSeat(tx, tenantId, entitlement);

      const [existingMember] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(
          and(eq(memberships.tenantId, tenantId), eq(users.email, input.email)),
        )
        .limit(1);

      if (existingMember) {
        throw new ConflictException('Email is already a workspace member');
      }

      await tx
        .update(workspaceInvitations)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(workspaceInvitations.tenantId, tenantId),
            eq(workspaceInvitations.email, input.email),
            eq(workspaceInvitations.status, 'pending'),
          ),
        );

      const rawToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * DAY_MS);
      const [invitation] = await tx
        .insert(workspaceInvitations)
        .values({
          tenantId,
          email: input.email,
          role: input.role,
          token: hashToken(rawToken),
          invitedBy: userId,
          expiresAt,
        })
        .returning({
          id: workspaceInvitations.id,
          email: workspaceInvitations.email,
          role: workspaceInvitations.role,
          expiresAt: workspaceInvitations.expiresAt,
        });

      const inviteUrl = `${env.WEB_URL}/invite?tenant=${tenantId}&token=${rawToken}`;
      console.info(`[DocVault Invite] ${input.email}: ${inviteUrl}`);

      return {
        ...invitation,
        ...(env.NODE_ENV !== 'production' ? { inviteUrl } : {}),
      };
    });
  }

  async acceptInvitation(
    tenantId: string,
    token: string,
    user: { id: string; email: string },
  ) {
    return withTenantTransaction(db, tenantId, async (tx) => {
      const [invitation] = await tx
        .select()
        .from(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.tenantId, tenantId),
            eq(workspaceInvitations.token, hashToken(token)),
            eq(workspaceInvitations.status, 'pending'),
          ),
        )
        .limit(1);

      if (!invitation || invitation.expiresAt.getTime() <= Date.now()) {
        throw new NotFoundException('Invitation is invalid or expired');
      }

      if (invitation.email !== user.email.toLowerCase()) {
        throw new ForbiddenException(
          'Sign in with the email address that received this invitation',
        );
      }

      const entitlement = await this.entitlement.summarize(tx, tenantId);
      await this.quota.assertSeat(tx, tenantId, entitlement);

      await tx
        .insert(memberships)
        .values({
          tenantId,
          userId: user.id,
          role: invitation.role,
        })
        .onConflictDoNothing({
          target: [memberships.tenantId, memberships.userId],
        });

      await tx
        .update(workspaceInvitations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(workspaceInvitations.id, invitation.id));

      return { success: true, tenantId };
    });
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
