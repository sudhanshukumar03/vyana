CREATE TABLE google_health_connections (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  generation UUID NOT NULL, provider_subject TEXT NOT NULL UNIQUE, account_email TEXT NOT NULL,
  encrypted_tokens TEXT NOT NULL, access_expires_at TIMESTAMPTZ NOT NULL,
  last_synced_at TIMESTAMPTZ, last_attempt_at TIMESTAMPTZ, error_code TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE google_health_oauth_states (
  state_hash TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  encrypted_verifier TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX google_health_oauth_expiry ON google_health_oauth_states(expires_at);
CREATE TABLE google_health_days (
  user_id INT NOT NULL REFERENCES google_health_connections(user_id) ON DELETE CASCADE,
  timezone TEXT NOT NULL, day DATE NOT NULL, steps INT, distance_km DOUBLE PRECISION,
  PRIMARY KEY(user_id,timezone,day), CHECK(steps IS NULL OR steps>=0),
  CHECK(distance_km IS NULL OR distance_km>=0)
);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='healthguard_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON google_health_connections,google_health_oauth_states,google_health_days TO healthguard_app;
  END IF;
END $$;
