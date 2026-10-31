/** Offset in milliseconds, raw ADC (0..4095), lead flags (LO+ bit 0, LO- bit 1). */
export type ECGSample = [number,number,number];
export interface ECGBatch {
  id:number;device_id:string;session_id:string;sequence:number;
  observed_at:string;source:'ESP32_MAX30102_DS18B20_AD8232';samples:ECGSample[];
}
export interface ECGStream {device_id:string|null;cursor:number;batches:ECGBatch[]}
