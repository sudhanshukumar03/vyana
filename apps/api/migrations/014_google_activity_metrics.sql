ALTER TABLE google_health_days
  ADD COLUMN active_calories_kcal DOUBLE PRECISION CHECK(active_calories_kcal BETWEEN 0 AND 1000000000),
  ADD COLUMN active_minutes INT CHECK(active_minutes BETWEEN 0 AND 2880);
ALTER TABLE google_health_connections
  ADD COLUMN metric_warnings TEXT[] NOT NULL DEFAULT '{}';
