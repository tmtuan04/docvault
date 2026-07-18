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
  db/        Database package placeholder
  shared/    Shared types and constants
```

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm infra:up
pnpm dev
```

The web app runs at `http://localhost:3000` and the API at
`http://localhost:3001`.

## Local infrastructure

`infra/docker-compose.yml` provides the backing services used in development:

| Service    | Port(s)       | Purpose                                    |
| ---------- | ------------- | ------------------------------------------ |
| PostgreSQL | `5432`        | Multi-tenant database (pgvector enabled)   |
| Redis      | `6379`        | Queue backend for background workers        |
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

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Copy `.env.example` to `.env` after PostgreSQL, Redis, and object storage are
introduced.
