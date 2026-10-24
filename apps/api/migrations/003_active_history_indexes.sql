-- Point active-source reads directly at its chronology, including an empty new source.
CREATE INDEX vitals_device_time ON vitals(device_id,observed_at DESC,id DESC);
CREATE INDEX activity_device_time ON activity(device_id,observed_at DESC,id DESC);
