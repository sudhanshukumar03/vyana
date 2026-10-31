CREATE TABLE sos_preferences (
  user_id INT PRIMARY KEY REFERENCES users(id), settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE sos_observations (
  id BIGSERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
  device_id UUID NOT NULL REFERENCES devices(id), observed_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL, priority SMALLINT NOT NULL DEFAULT 0,
  heart_rate INT, spo2 DOUBLE PRECISION, temperature DOUBLE PRECISION,
  ecg_status TEXT NOT NULL, quality TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE(device_id,observed_at)
);
CREATE INDEX sos_observations_owner_time ON sos_observations(user_id,observed_at DESC);
CREATE TABLE sos_monitor_state (
  user_id INT PRIMARY KEY REFERENCES users(id), device_id UUID NOT NULL REFERENCES devices(id),
  observed_at TIMESTAMPTZ NOT NULL, signals JSONB NOT NULL DEFAULT '{}', fault_since TIMESTAMPTZ
);
CREATE TABLE sos_incidents (
  id UUID PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
  device_id UUID REFERENCES devices(id), alert_id INT REFERENCES alerts(id),
  kind TEXT NOT NULL CHECK(kind IN ('manual','automatic','daily','sensor_fault')),
  status TEXT NOT NULL CHECK(status IN ('pending','queued','cancelled','recorded','processed')),
  reason TEXT NOT NULL, report JSONB NOT NULL, dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), due_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id,dedupe_key)
);
CREATE INDEX sos_incidents_due ON sos_incidents(due_at) WHERE status='pending';
CREATE TABLE sos_notifications (
  id BIGSERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
  incident_id UUID NOT NULL REFERENCES sos_incidents(id) ON DELETE CASCADE,
  contact_id INT REFERENCES emergency_contact(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL, destination TEXT NOT NULL, include_report BOOLEAN NOT NULL DEFAULT TRUE,
  channel TEXT NOT NULL CHECK(channel IN ('email','sms','call')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','blocked','sending','submitted','failed','unknown','cancelled')),
  provider_id TEXT, error_code TEXT, attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(incident_id,contact_id,channel)
);
CREATE INDEX sos_notifications_due ON sos_notifications(next_attempt_at) WHERE status IN ('pending','blocked');
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='healthguard_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON sos_preferences,sos_observations,sos_monitor_state,sos_incidents,sos_notifications TO healthguard_app;
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO healthguard_app;
  END IF;
END $$;
