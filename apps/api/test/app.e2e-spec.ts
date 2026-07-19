import { createHash, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  documents,
  eq,
  tenants,
  users,
  withTenantTransaction,
} from '@document-saas/db';
import request from 'supertest';

import { AppModule } from './../src/app.module.js';
import { db } from './../src/database.js';
import { databaseClient as workerDatabaseClient } from '../../worker/src/database.js';
import { processIngestJob } from '../../worker/src/ingest.js';

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

interface UploadUrlBody {
  document: { id: string; name: string; status: string };
  version: { id: string; storageKey: string };
  uploadUrl: string;
  headers: Record<string, string>;
}

interface DocumentListItem {
  id: string;
  status: string;
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

  it('uploads a text document, ingests chunks, then searches and chats', async () => {
    const email = `docs-${randomUUID()}@example.test`;
    const agent = request.agent(app.getHttpServer() as Server);
    let tenantId = '';

    try {
      await agent
        .post('/api/auth/email-otp/send-verification-otp')
        .send({ email, type: 'sign-in' })
        .expect(200);
      await agent
        .post('/api/auth/sign-in/email-otp')
        .send({ email, otp: '123456', name: 'Docs User' })
        .expect(200);

      const created = await agent
        .post('/api/workspaces')
        .send({ name: 'Docs Workspace' })
        .expect(201);
      tenantId = (created.body as CreatedWorkspaceBody).id;

      const content = Buffer.from(
        'Hop dong dich vu DocVault. Thoi han thanh toan la 15 ngay ke tu ngay xuat hoa don.',
        'utf8',
      );
      const checksum = createHash('sha256').update(content).digest('hex');

      const upload = await agent
        .post(`/api/workspaces/${tenantId}/documents/upload-url`)
        .send({
          fileName: 'hop-dong.txt',
          mimeType: 'text/plain',
          sizeBytes: content.byteLength,
        })
        .expect(201);
      const uploadBody = upload.body as UploadUrlBody;

      const storagePut = await fetch(uploadBody.uploadUrl, {
        method: 'PUT',
        headers: uploadBody.headers,
        body: content,
      });
      expect(storagePut.ok).toBe(true);

      await agent
        .post(`/api/workspaces/${tenantId}/documents/complete`)
        .send({
          documentId: uploadBody.document.id,
          documentVersionId: uploadBody.version.id,
          checksum,
        })
        .expect(201);

      await processIngestJob({
        tenantId,
        documentId: uploadBody.document.id,
        documentVersionId: uploadBody.version.id,
        storageKey: uploadBody.version.storageKey,
        mimeType: 'text/plain',
        fileName: 'hop-dong.txt',
      });

      const listed = await agent
        .get(`/api/workspaces/${tenantId}/documents`)
        .expect(200);
      const docs = listed.body as DocumentListItem[];
      expect(docs[0]?.status).toBe('ready');

      const search = await agent
        .get(`/api/workspaces/${tenantId}/search`)
        .query({ q: 'thanh toan' })
        .expect(200);
      expect(
        (search.body as { results: unknown[] }).results.length,
      ).toBeGreaterThan(0);

      const chat = await agent
        .post(`/api/workspaces/${tenantId}/chat`)
        .send({ message: 'Thoi han thanh toan la bao nhieu ngay?' })
        .expect(201);
      const chatBody = chat.body as {
        answer: string;
        citations: Array<{ documentId: string }>;
      };
      expect(chatBody.answer.length).toBeGreaterThan(0);
      expect(chatBody.citations[0]?.documentId).toBe(uploadBody.document.id);

      const foreignTenant = randomUUID();
      await agent.get(`/api/workspaces/${foreignTenant}/documents`).expect(404);
    } finally {
      if (tenantId) {
        await withTenantTransaction(db, tenantId, async (tx) => {
          await tx.delete(documents).where(eq(documents.tenantId, tenantId));
          await tx.delete(tenants).where(eq(tenants.id, tenantId));
        });
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
    await workerDatabaseClient.close();
  });
});
