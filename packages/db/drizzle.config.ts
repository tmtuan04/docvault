/**
 * Drizzle Kit configuration used by generate, migrate and Studio commands.
 *
 * This file intentionally uses the admin URL because schema migrations require
 * DDL privileges. API and worker processes must use DATABASE_URL instead.
 */
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({
  // Resolve from this file so commands work regardless of the current cwd.
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

const adminUrl = process.env.DATABASE_ADMIN_URL;

if (!adminUrl) {
  throw new Error(
    'DATABASE_ADMIN_URL is required. Copy .env.example to .env before running migrations.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  // TypeScript is the schema source of truth; generated SQL goes to drizzle/.
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: adminUrl,
  },
  strict: true,
  verbose: true,
});
