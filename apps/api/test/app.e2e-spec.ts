import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq, tenants, users, withTenantTransaction } from '@document-saas/db';
import request from 'supertest';

import { AppModule } from './../src/app.module.js';
import { db } from './../src/database.js';

interface CreatedWorkspaceBody {
  id: string;
  role: string;
  status: string;
  plan: string;
  trial: { daysRemaining: number };
}

interface ListedWorkspaceBody {
  id: string;
}

interface MemberBody {
  email: string;
  role: string;
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter(), {
      bodyParser: false,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer() as Server)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('signs in with OTP and creates an isolated trial workspace', async () => {
    const email = `e2e-${randomUUID()}@example.test`;
    const agent = request.agent(app.getHttpServer() as Server);
    let tenantId = '';

    try {
      await agent
        .post('/api/auth/email-otp/send-verification-otp')
        .send({ email, type: 'sign-in' })
        .expect(200);

      await agent
        .post('/api/auth/sign-in/email-otp')
        .send({ email, otp: '123456', name: 'E2E User' })
        .expect(200);

      const created = await agent
        .post('/api/workspaces')
        .send({ name: 'E2E Workspace' })
        .expect(201);
      const createdBody = created.body as unknown as CreatedWorkspaceBody;

      tenantId = createdBody.id;
      expect(createdBody.role).toBe('owner');
      expect(createdBody.status).toBe('trialing');
      expect(createdBody.plan).toBe('team');
      expect(createdBody.trial.daysRemaining).toBe(14);

      const listed = await agent.get('/api/workspaces').expect(200);
      const listedBody = listed.body as unknown as ListedWorkspaceBody[];
      expect(listedBody).toHaveLength(1);
      expect(listedBody[0]?.id).toBe(tenantId);

      const members = await agent
        .get(`/api/workspaces/${tenantId}/members`)
        .expect(200);
      const membersBody = members.body as unknown as MemberBody[];
      expect(membersBody).toHaveLength(1);
      expect(membersBody[0]?.email).toBe(email);
      expect(membersBody[0]?.role).toBe('owner');
    } finally {
      if (tenantId) {
        await withTenantTransaction(db, tenantId, (tx) =>
          tx.delete(tenants).where(eq(tenants.id, tenantId)),
        );
      }
      await db.delete(users).where(eq(users.email, email));
    }
  });

  it('rejects anonymous workspace access', () => {
    return request(app.getHttpServer() as Server)
      .get('/api/workspaces')
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
