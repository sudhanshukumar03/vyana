CREATE TABLE ecg_batches (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  sequence BIGINT NOT NULL CHECK(sequence BETWEEN 1 AND 9007199254740863),
  observed_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(50) NOT NULL,
  samples JSONB NOT NULL CHECK(jsonb_typeof(samples)='array' AND jsonb_array_length(samples) BETWEEN 1 AND 128),
  UNIQUE(device_id,session_id,sequence)
);
CREATE INDEX ecg_batches_owner_device_id ON ecg_batches(user_id,device_id,id);
CREATE INDEX ecg_batches_observed ON ecg_batches(observed_at);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='healthguard_app') THEN
    GRANT SELECT,INSERT,DELETE ON ecg_batches TO healthguard_app;
    GRANT USAGE,SELECT ON SEQUENCE ecg_batches_id_seq TO healthguard_app;
  END IF;
END $$;
