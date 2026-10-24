-- The Compose init script creates this restricted role before migrations run.
-- Separately managed deployments can grant equivalent privileges to their app role.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='healthguard_app') THEN
    GRANT USAGE ON SCHEMA public TO healthguard_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON users,sessions,account_tokens,delivery_outbox,devices,profile,emergency_contact,vitals,activity,alerts TO healthguard_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO healthguard_app;
    REVOKE ALL ON SCHEMA legacy FROM healthguard_app;
    REVOKE CREATE ON SCHEMA public FROM healthguard_app;
  END IF;
END $$;
