# Document SaaS

Monorepo for a multi-tenant document storage and RAG platform.

## Prerequisites

- Node.js 22 or newer
- pnpm 11

Docker is intentionally not required at this scaffold stage.

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
pnpm dev
```

The web app runs at `http://localhost:3000` and the API at
`http://localhost:3001`.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Copy `.env.example` to `.env` after PostgreSQL, Redis, and object storage are
introduced.
