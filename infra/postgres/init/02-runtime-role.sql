-- Local-only runtime role. Production credentials must be provisioned securely.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'docvault_app') THEN
    CREATE ROLE docvault_app
      LOGIN
      PASSWORD 'docvault_app'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE document_saas TO docvault_app;
GRANT USAGE ON SCHEMA public TO docvault_app;
