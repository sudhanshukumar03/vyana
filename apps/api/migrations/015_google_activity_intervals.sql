CREATE TABLE google_health_intervals (
  user_id INT NOT NULL REFERENCES google_health_connections(user_id) ON DELETE CASCADE,
  timezone TEXT NOT NULL, day DATE NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('steps','distance_km','active_calories_kcal','active_minutes')),
  start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION NOT NULL CHECK(value BETWEEN 0 AND 1000000000),
  PRIMARY KEY(user_id,timezone,day,start_at,metric,end_at), CHECK(end_at>start_at)
);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='healthguard_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON google_health_intervals TO healthguard_app;
  END IF;
END $$;
