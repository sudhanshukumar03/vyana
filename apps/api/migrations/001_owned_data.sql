-- Legacy patient data is preserved, never implicitly attached to a new account.
CREATE SCHEMA IF NOT EXISTS legacy;
REVOKE ALL ON SCHEMA legacy FROM PUBLIC;
DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['vitals','activity','alerts','device_status','profile','emergency_contact'] LOOP
    IF to_regclass('public.' || name) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=name AND column_name='user_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA legacy', name);
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE sessions (
  id UUID PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ
);
CREATE INDEX sessions_owner ON sessions(user_id);
CREATE TABLE account_tokens (
  token_hash TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('reset','verify')), expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
-- A local delivery sink; no real messages are sent by the application.
CREATE TABLE delivery_outbox (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), purpose TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE devices (
  id UUID PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), device_name VARCHAR(100) NOT NULL,
  credential_hash TEXT NOT NULL UNIQUE, revoked_at TIMESTAMPTZ, battery INT CHECK (battery BETWEEN 0 AND 100),
  connected BOOLEAN NOT NULL DEFAULT FALSE, last_seen TIMESTAMPTZ, source VARCHAR(50) NOT NULL DEFAULT 'Unknown',
  active BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX one_active_device ON devices(user_id) WHERE active AND revoked_at IS NULL;
CREATE INDEX devices_owner ON devices(user_id);
CREATE TABLE profile (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL UNIQUE REFERENCES users(id), full_name VARCHAR(100), dob DATE,
  sex VARCHAR(16), height_cm REAL CHECK (height_cm BETWEEN 50 AND 250), weight_kg REAL CHECK (weight_kg BETWEEN 20 AND 300),
  conditions TEXT, medications TEXT, allergies TEXT, activity_level VARCHAR(20), goal VARCHAR(100),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE emergency_contact (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), name VARCHAR(100) NOT NULL,
  phone VARCHAR(32), email VARCHAR(120), relation VARCHAR(50), is_doctor BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX contacts_owner ON emergency_contact(user_id);
CREATE TABLE vitals (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), device_id UUID NOT NULL REFERENCES devices(id),
  session_id UUID NOT NULL, sequence INT NOT NULL CHECK (sequence>=0), observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), timestamp TIMESTAMPTZ GENERATED ALWAYS AS (observed_at) STORED,
  heart_rate INT NOT NULL CHECK (heart_rate BETWEEN 0 AND 300), spo2 DOUBLE PRECISION NOT NULL CHECK (spo2 BETWEEN 0 AND 100),
  temperature DOUBLE PRECISION NOT NULL CHECK (temperature BETWEEN 20 AND 45), ecg_status VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL, UNIQUE(device_id,session_id,sequence)
);
CREATE INDEX vitals_owner_time ON vitals(user_id,observed_at DESC,id DESC);
CREATE TABLE activity (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), device_id UUID NOT NULL REFERENCES devices(id),
  session_id UUID NOT NULL, sequence INT NOT NULL CHECK(sequence>=0), observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), timestamp TIMESTAMPTZ GENERATED ALWAYS AS (observed_at) STORED,
  steps INT NOT NULL CHECK (steps>=0), distance_km DOUBLE PRECISION NOT NULL CHECK(distance_km>=0),
  calories INT NOT NULL CHECK(calories>=0), active_minutes INT NOT NULL CHECK(active_minutes>=0),
  source VARCHAR(50) NOT NULL, UNIQUE(device_id,session_id,sequence)
);
CREATE INDEX activity_owner_time ON activity(user_id,observed_at DESC,id DESC);
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), device_id UUID REFERENCES devices(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), severity VARCHAR(20) NOT NULL,
  title VARCHAR(100) NOT NULL, detail TEXT NOT NULL, metric VARCHAR(50) NOT NULL, direction TEXT NOT NULL DEFAULT 'high',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','resolved')), acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ, last_emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), recovery_count INT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX active_metric_episode ON alerts(device_id,metric,direction) WHERE status='active';
CREATE INDEX alerts_owner_state ON alerts(user_id,status,severity,id DESC);
