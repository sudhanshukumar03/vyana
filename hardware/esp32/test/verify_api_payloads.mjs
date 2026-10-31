import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vitalsSchema, deviceSchema } from '../../../apps/api/src/schemas.ts';

const filename = process.argv[2];
if (!filename) throw new Error('Pass the JSON capture created with FIRMWARE_CAPTURE_PATH during native tests.');
const records = JSON.parse(readFileSync(filename, 'utf8'));
assert.equal(records.length, 2);
const schemas = new Map([
  ['ingest/vitals', vitalsSchema], ['device/status', deviceSchema],
]);
const seen = new Set();
for (const { endpoint, payload } of records) {
  assert(schemas.has(endpoint), `Unexpected endpoint: ${endpoint}`);
  assert(!seen.has(endpoint), `Duplicate endpoint: ${endpoint}`);
  schemas.get(endpoint).parse(payload);
  seen.add(endpoint);
}
assert.equal(records.find(record => record.endpoint === 'ingest/vitals').payload.source, 'ESP32_MAX30102_DS18B20_AD8232');
console.log('Both sensor firmware payloads pass the current strict API schemas.');
