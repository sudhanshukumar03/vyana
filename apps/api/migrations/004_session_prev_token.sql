-- Keep the pre-rotation refresh-token hash so a logout racing a refresh can
-- still identify the session row after rotation overwrites token_hash.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS prev_token_hash TEXT;
CREATE INDEX IF NOT EXISTS sessions_prev_token ON sessions(prev_token_hash);
