ALTER TABLE profile
  ADD COLUMN energy_activity TEXT CHECK(energy_activity IN ('inactive','low_active','active','very_active')),
  ADD COLUMN nutrition_review TEXT NOT NULL DEFAULT 'unknown' CHECK(nutrition_review IN ('unknown','standard','required')),
  ADD COLUMN weight_goal_type TEXT NOT NULL DEFAULT 'maintain' CHECK(weight_goal_type IN ('maintain','reduce','gain')),
  ADD COLUMN goal_weight_kg DOUBLE PRECISION CHECK(goal_weight_kg BETWEEN 20 AND 300);
CREATE TABLE weight_measurements (
  id BIGSERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg DOUBLE PRECISION NOT NULL CHECK(weight_kg BETWEEN 20 AND 300),
  observed_at TIMESTAMPTZ NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK(source IN ('profile','manual')),
  UNIQUE(user_id,observed_at)
);
CREATE INDEX weight_measurements_owner ON weight_measurements(user_id,observed_at DESC,id DESC);
ALTER TABLE google_health_connections
  ADD COLUMN next_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN sync_failures INT NOT NULL DEFAULT 0,
  ADD COLUMN history_synced_at TIMESTAMPTZ;
CREATE INDEX google_health_due ON google_health_connections(next_sync_at);
ALTER TABLE google_health_days
  ADD COLUMN light_minutes INT CHECK(light_minutes BETWEEN 0 AND 2880),
  ADD COLUMN moderate_minutes INT CHECK(moderate_minutes BETWEEN 0 AND 2880),
  ADD COLUMN vigorous_minutes INT CHECK(vigorous_minutes BETWEEN 0 AND 2880);
CREATE TABLE google_health_feed_state (
  user_id INT NOT NULL REFERENCES google_health_connections(user_id) ON DELETE CASCADE,
  feed TEXT NOT NULL CHECK(feed IN ('steps','distance','active-energy-burned','active-minutes','exercise')),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_success_at TIMESTAMPTZ,error_code TEXT,
  PRIMARY KEY(user_id,feed)
);
CREATE TABLE google_health_hour_totals (
  user_id INT NOT NULL REFERENCES google_health_connections(user_id) ON DELETE CASCADE,
  timezone TEXT NOT NULL,day DATE NOT NULL,start_at TIMESTAMPTZ NOT NULL,end_at TIMESTAMPTZ NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('steps','distance_km','active_calories_kcal','active_minutes')),
  value DOUBLE PRECISION NOT NULL CHECK(value BETWEEN 0 AND 1000000000),record_count INT NOT NULL CHECK(record_count>0),
  PRIMARY KEY(user_id,timezone,day,start_at,metric),CHECK(end_at>start_at)
);
CREATE TABLE google_health_exercises (
  user_id INT NOT NULL REFERENCES google_health_connections(user_id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,end_at TIMESTAMPTZ NOT NULL,exercise_type TEXT NOT NULL,
  active_seconds DOUBLE PRECISION CHECK(active_seconds>=0),source TEXT NOT NULL DEFAULT 'Google Health',
  PRIMARY KEY(user_id,start_at,end_at,exercise_type),CHECK(end_at>start_at)
);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='healthguard_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON weight_measurements,google_health_feed_state,google_health_hour_totals,google_health_exercises TO healthguard_app;
    GRANT USAGE,SELECT ON SEQUENCE weight_measurements_id_seq TO healthguard_app;
  END IF;
END $$;
