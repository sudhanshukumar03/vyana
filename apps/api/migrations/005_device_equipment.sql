-- Latest independently measured equipment snapshot; complete vitals stay separate.
ALTER TABLE devices ADD COLUMN equipment JSONB;
