import type { DeviceStatus, EquipmentSnapshot } from '../../../../shared/types/health';
import type { VitalReading } from '../../../../shared/types/health';

// BackOffice_Simulator is a back-office demo tool that writes real DB rows
// (device, vitals, ECG batches). The main page must display those values as a
// normal live source, not filter them out.
// Client-side generators (DisplayPreview, legacy ESP32_MPU6050_Simulated, etc.)
// are still filtered.
const BACKOFFICE = 'BackOffice_Simulator';

export const isGeneratedSource = (source: string) =>
  source !== BACKOFFICE && /simulat|generated|preview/i.test(source);

/** Equipment is live only for the selected, connected device and a fresh observation. */
export function liveEquipment(device: DeviceStatus | null, now=Date.now(), staleSeconds=30): EquipmentSnapshot | null {
  if (!device?.active || !device.connected || !device.equipment || !device.last_seen) return null;
  // This legacy hub reports real equipment and separately simulated steps.
  // BackOffice_Simulator writes real DB rows and must be treated as a live device.
  if (device.source !== 'ESP32_RealVitals_SimulatedSteps' && device.source !== BACKOFFICE && isGeneratedSource(device.source)) return null;
  const age=now-Date.parse(device.equipment.observed_at), heartbeatAge=now-Date.parse(device.last_seen);
  if (!Number.isFinite(age)||age < -5000||age > staleSeconds*1000 ||
      !Number.isFinite(heartbeatAge)||heartbeatAge < -5000||heartbeatAge > staleSeconds*1000) return null;
  return device.equipment;
}

/** A new explicit null invalidates a current reading; an omitted legacy field does not. */
export function currentSensorReadings(data: Partial<VitalReading>, equipment?: EquipmentSnapshot | null) {
  const useEquipment=Boolean(equipment&&(!data.timestamp||Date.parse(equipment.observed_at)>=Date.parse(data.timestamp)));
  return {
    heart_rate: useEquipment&&equipment!.heart_rate!==undefined ? equipment!.heart_rate : data.heart_rate,
    spo2: useEquipment&&equipment!.spo2!==undefined ? equipment!.spo2 : data.spo2,
    temperature: useEquipment ? equipment!.temperature_c : data.temperature,
    ecg_status: useEquipment ? equipment!.ecg_status : data.ecg_status,
    fromEquipment: useEquipment,
  };
}

/** Product labels are separate from the unchanged telemetry provenance. */
export function readingSourceLabel(source?: string | null) {
  if (!source) return 'No active source';
  if (source==='ESP32_RealVitals_SimulatedSteps') return 'ESP32 sensor hub';
  if (source==='ESP32_MAX30102_DS18B20_AD8232') return 'ESP32 health sensors';
  if (source === BACKOFFICE) return 'Live';
  if (/simulat|generated/i.test(source)) return 'Generated activity feed';
  return source;
}
