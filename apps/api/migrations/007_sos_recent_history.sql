-- Reuse already recorded hardware observations for the first 24-hour report.
-- Simulator records remain in ordinary history and cannot trigger automatic SOS.
INSERT INTO sos_observations(user_id,device_id,observed_at,source,priority,heart_rate,spo2,temperature,ecg_status,quality)
SELECT DISTINCT ON(device_id,observed_at) user_id,device_id,observed_at,source,0,
  NULLIF(heart_rate,0),NULLIF(spo2,0),temperature,ecg_status,
  CASE WHEN ecg_status='Leads Off' THEN ARRAY['ECG leads off'] ELSE ARRAY[]::text[] END
FROM vitals WHERE observed_at>=NOW()-INTERVAL '24 hours'
  AND source='ESP32_MAX30102_DS18B20_AD8232'
ORDER BY device_id,observed_at,id DESC
ON CONFLICT(device_id,observed_at) DO NOTHING;
