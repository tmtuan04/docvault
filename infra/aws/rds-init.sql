-- Run once as a privileged Postgres role before pnpm db:migrate.
-- Supabase: paste into SQL Editor (role postgres), or:
--   psql "$DATABASE_ADMIN_URL" -f infra/aws/rds-init.sql
-- Replace the password before executing in production.
--
-- On Supabase the default database name is `postgres`.
-- On local Docker / RDS you may use `document_saas` instead — adjust GRANT CONNECT.

CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'docvault_app') THEN
    CREATE ROLE docvault_app
      LOGIN
      PASSWORD 'CHANGE_ME_STRONG_PASSWORD'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS;
  END IF;
END
$$;

-- Supabase:
GRANT CONNECT ON DATABASE postgres TO docvault_app;
-- Local / RDS alternative:
-- GRANT CONNECT ON DATABASE document_saas TO docvault_app;
