CREATE TABLE equipment_history (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(100) NOT NULL, equipment JSONB NOT NULL,
  UNIQUE(device_id,observed_at)
);
CREATE INDEX equipment_history_owner ON equipment_history(user_id,device_id,id DESC);
CREATE INDEX equipment_history_age ON equipment_history(observed_at);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='healthguard_app') THEN
    GRANT SELECT,INSERT,DELETE ON equipment_history TO healthguard_app;
    GRANT USAGE,SELECT ON SEQUENCE equipment_history_id_seq TO healthguard_app;
  END IF;
END $$;
