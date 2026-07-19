# Document SaaS

Monorepo for a multi-tenant document storage and RAG platform.

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- Docker Engine + Compose plugin (for local infrastructure)

## Workspace

```text
apps/
  web/       Next.js frontend
  api/       NestJS API
  worker/    Background worker
packages/
  db/        Drizzle schema, migrations, and tenant-scoped DB helpers
  shared/    Shared types and constants
```

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate
pnpm dev
```

The web app runs at `http://localhost:3000` and the API at
`http://localhost:3001`.

## Local infrastructure

`infra/docker-compose.yml` provides the backing services used in development:

| Service    | Port(s)       | Purpose                                    |
| ---------- | ------------- | ------------------------------------------ |
| PostgreSQL | `5432`        | Multi-tenant database (pgvector enabled)   |
| Redis      | `6379`        | Queue backend for background workers       |
| MinIO      | `9000`/`9001` | S3-compatible object storage (API/console) |

MinIO stands in for Cloudflare R2 locally; the `documents` bucket is created
automatically on first start. Data is persisted under `.data/` (git-ignored).

```bash
pnpm infra:up      # start services in the background
pnpm infra:ps      # check status (wait for healthy)
pnpm infra:logs    # follow logs
pnpm infra:down    # stop and remove containers (keeps .data/)
```

MinIO console: `http://localhost:9001` (user `minio` / password `miniosecret`).

To reset all local data:

```bash
pnpm infra:down && rm -rf .data
```

## Database

The PostgreSQL schema and migrations live in `packages/db`. Runtime queries use
the non-superuser `docvault_app` role so PostgreSQL Row Level Security cannot be
bypassed accidentally. Drizzle migrations use the separate local admin URL.

```bash
pnpm db:generate   # generate a migration after changing src/schema.ts
pnpm db:migrate    # apply pending migrations
pnpm db:check      # validate generated migration metadata
pnpm db:smoke-rls  # prove tenant A cannot read/write tenant B data
pnpm db:studio     # inspect local data (admin access; bypasses RLS)
```

Tenant-scoped application queries must run through
`withTenantTransaction(db, tenantId, callback)`. It uses a transaction-local
PostgreSQL setting, preventing pooled connections from leaking tenant context
between requests.

## Authentication and workspaces

Better Auth is mounted by NestJS at `http://localhost:3001/api/auth`. The web
app uses Email OTP sign-in. In local development, request a code at
`http://localhost:3000/login` and read it from the terminal running the API:

```text
[DocVault OTP] sign-in code for you@example.com: 123456
```

After login, the dashboard can create a workspace with a 14-day Team trial,
switch workspaces, list members, and create invitation links. Console OTP
delivery is blocked in production; configure a real email provider before
deploying.

## Documents, ingest and RAG

`pnpm dev` starts the web app, API and BullMQ worker together.

1. Upload PDF/DOCX/TXT/MD from the dashboard (presigned PUT to MinIO).
2. API marks the document `processing` and enqueues an ingest job on Redis.
3. Worker extracts text, chunks it, writes embeddings into `document_chunks`,
   then marks the document `ready`.
4. Keyword search and RAG chat become available for that workspace.

Local default is `AI_PROVIDER=mock` (deterministic embeddings/chat, no paid
key). Set `AI_PROVIDER=openai` and `OPENAI_API_KEY` to use real models.

## Frontend UI

All product UI in `apps/web` uses Tailwind CSS v4 and shadcn/ui. Add missing
primitives through the CLI instead of introducing another component library:

```bash
cd apps/web
pnpm dlx shadcn@latest add <component>
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @document-saas/api test:e2e --runInBand
```
