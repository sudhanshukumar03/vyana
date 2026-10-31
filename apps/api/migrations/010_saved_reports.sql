CREATE TABLE saved_reports (
  id UUID PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_metadata TEXT NOT NULL, encrypted_document TEXT NOT NULL,
  size_bytes INT NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX saved_reports_owner ON saved_reports(user_id,created_at DESC);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='healthguard_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON saved_reports TO healthguard_app;
  END IF;
END $$;
