import { randomUUID, randomBytes, createHash } from 'crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ingest, type Broadcast } from './telemetry';
import { ecgStorage } from './ecg';
import type { reportStorage } from './reports';
import { transaction } from './db';
import { HttpError } from './auth';

export const SIMULATION_SOURCE = 'BackOffice_Simulator';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');

export const simulateVitalsSchema = z.object({
  heart_rate: z.number().int().min(20).max(300),
  spo2: z.number().min(50).max(100),
  temperature: z.number().min(30).max(45),
  ecg_status: z.enum(['Normal', 'Irregular', 'Leads Off', 'Unknown']),
  generate_ecg_batch: z.boolean().default(true),
  source: z.literal(SIMULATION_SOURCE).default(SIMULATION_SOURCE),
}).strict();

export interface SimulationResult {
  success: boolean;
  vitals: Record<string, unknown>;
  device: Record<string, unknown>;
  alerts_count: number;
}

/**
 * Keep generated data on a dedicated device. Selection is an explicit user action.
 */
export async function ensureSimulatorDevice(pool: Pool, userId: number) {
  return transaction(pool, async client => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const existing = (await client.query(
      'SELECT * FROM devices WHERE user_id=$1 AND source=$2 AND revoked_at IS NULL ORDER BY id LIMIT 1',
      [userId, SIMULATION_SOURCE]
    )).rows[0];
    if (existing) return existing;
    return (await client.query(
      `INSERT INTO devices (id,user_id,device_name,credential_hash,source,active,battery)
       VALUES ($1,$2,'Back-Office Simulator',$3,$4,FALSE,NULL) RETURNING *`,
      [randomUUID(),userId,digest(randomToken()),SIMULATION_SOURCE]
    )).rows[0];
  });
}

/**
 * Generates realistic AD8232 ECG samples adhering to standard P-Q-R-S-T morphology
 * tailored to the requested heart rate and rhythm classification.
 */
export function synthesizeEcgSamples(
  heartRate: number,
  rhythm: 'Normal' | 'Irregular' | 'Leads Off' | 'Unknown'
): Array<[number, number, number]> {
  const sampleCount = 128;
  const sampleIntervalMs = 10; // 100 Hz
  const rrIntervalMs = Math.max(300, Math.min(2000, (60 / heartRate) * 1000));
  const samples: Array<[number, number, number]> = [];

  for (let i = 0; i < sampleCount; i++) {
    const offsetMs = i * sampleIntervalMs;

    // If leads are detached: return baseline noise + disconnected lead flag
    if (rhythm === 'Leads Off') {
      const noise = 2048 + Math.round((Math.random() - 0.5) * 80);
      samples.push([offsetMs, Math.max(0, Math.min(4095, noise)), 3]);
      continue;
    }

    // Calculate phase within the current cardiac cycle [0.0, 1.0)
    let cyclePhase = (offsetMs % rrIntervalMs) / rrIntervalMs;

    // Introduce ectopic variations for irregular rhythms
    if (rhythm === 'Irregular' && i > 40 && i < 70) {
      cyclePhase = ((offsetMs * 1.45) % rrIntervalMs) / rrIntervalMs;
    }

    // Baseline ~2048 with slight natural physiological breathing wander
    let adc = 2048 + Math.round(24 * Math.sin(offsetMs / 450));

    // P Wave: atrial depolarization (~18% of cycle, width 0.04, height +140)
    const pDist = Math.abs(cyclePhase - 0.18);
    if (pDist < 0.07) {
      adc += Math.round(140 * Math.exp(-((pDist / 0.028) ** 2)));
    }

    // Q Dip: initial ventricular depolarization (~33% of cycle, height -120)
    const qDist = Math.abs(cyclePhase - 0.33);
    if (qDist < 0.03) {
      adc -= Math.round(120 * Math.exp(-((qDist / 0.012) ** 2)));
    }

    // R Peak: major ventricular depolarization (~36% of cycle, height +1250)
    const rDist = Math.abs(cyclePhase - 0.36);
    if (rDist < 0.035) {
      const rHeight = rhythm === 'Irregular' && i > 40 && i < 70 ? 1550 : 1250;
      adc += Math.round(rHeight * Math.exp(-((rDist / 0.01) ** 2)));
    }

    // S Dip: late ventricular depolarization (~39% of cycle, height -320)
    const sDist = Math.abs(cyclePhase - 0.39);
    if (sDist < 0.035) {
      adc -= Math.round(320 * Math.exp(-((sDist / 0.014) ** 2)));
    }

    // T Wave: ventricular repolarization (~62% of cycle, width 0.07, height +260)
    const tDist = Math.abs(cyclePhase - 0.62);
    if (tDist < 0.1) {
      adc += Math.round(260 * Math.exp(-((tDist / 0.045) ** 2)));
    }

    // Clamp within 12-bit ADC range (0 - 4095)
    const clampedAdc = Math.max(0, Math.min(4095, adc));
    samples.push([offsetMs, clampedAdc, 0]); // 0 = Leads On / Normal contact
  }

  return samples;
}

/**
 * Ingests a new set of simulated sensor telemetry, updates device status,
 * generates an ECG trace batch, and broadcasts real-time updates over WebSocket.
 */
export async function simulateTelemetry(
  pool: Pool,
  userId: number,
  input: z.infer<typeof simulateVitalsSchema>,
  staleSeconds: number,
  broadcast: Broadcast
): Promise<SimulationResult> {
  const device = await ensureSimulatorDevice(pool, userId);

  // Each generated segment is independent. Concurrent requests must not reuse
  // a vital identity or increment an ECG sample ordinal by just one batch.
  const sessionId = randomUUID();
  const sequence = 1;
  const nowIso = new Date().toISOString();

  // 1. Ingest vitals
  const vitalsPayload = {
    session_id: sessionId,
    sequence,
    observed_at: nowIso,
    source: SIMULATION_SOURCE,
    heart_rate: input.heart_rate,
    spo2: Number(input.spo2.toFixed(1)),
    temperature: Number(input.temperature.toFixed(1)),
    ecg_status: input.ecg_status,
  };

  await ingest(pool, device, 'vitals', vitalsPayload, staleSeconds, broadcast);

  // 2. Update device status and equipment
  const equipment = {
    observed_at: nowIso,
    temperature_c: input.temperature,
    heart_rate: input.heart_rate,
    spo2: input.spo2,
    ecg_status: input.ecg_status === 'Leads Off' ? ('Leads Off' as const) : ('Unknown' as const),
    ecg_raw_adc: 2048,
    ecg_millivolts: Math.round((2048 / 4095) * 3300),
    ecg_samples: 1280,
    ecg_clipped_samples: 0,
  };

  const updatedDevice = (
    await pool.query(
      `UPDATE devices SET connected=TRUE, last_seen=NOW(), equipment=CASE
       WHEN (equipment->>'observed_at')::timestamptz>($1::jsonb->>'observed_at')::timestamptz THEN equipment ELSE $1::jsonb END
       WHERE id=$2 AND revoked_at IS NULL RETURNING id, device_name, connected, battery, last_seen, source, active, equipment`,
      [JSON.stringify(equipment), device.id]
    )
  ).rows[0];

  if (updatedDevice?.active) broadcast(userId, 'health_update', { type: 'device', data: updatedDevice });

  // 3. Generate ECG Batch if requested
  if (input.generate_ecg_batch) {
    const samples = synthesizeEcgSamples(input.heart_rate, input.ecg_status);
    const ecgBatch = {
      session_id: sessionId,
      sequence,
      observed_at: new Date(Date.parse(nowIso)-samples.at(-1)![0]).toISOString(),
      source: SIMULATION_SOURCE,
      samples,
    };
    const ecg = ecgStorage(pool);
    await ecg.accept(userId, device.id, ecgBatch, true);
  }

  // 4. Read latest active alerts
  const alerts = (
    await pool.query(
      "SELECT id FROM alerts WHERE user_id=$1 AND status='active'",
      [userId]
    )
  ).rowCount;

  // 5. Read back newly inserted vitals row
  const insertedVitals = (
    await pool.query(
      'SELECT * FROM vitals WHERE device_id=$1 AND session_id=$2 AND sequence=$3',
      [device.id, sessionId, sequence]
    )
  ).rows[0];

  return {
    success: true,
    vitals: insertedVitals,
    device: updatedDevice,
    alerts_count: alerts ?? 0,
  };
}

/**
 * Seeds a continuous historical timeline (e.g. 20-30 readings) across past hours
 * so charts, trends, and reports reflect a realistic patient record.
 */
export async function seedHistoricalTelemetry(
  pool: Pool,
  userId: number,
  hours = 12,
  baseHeartRate = 74,
  baseSpo2 = 98,
  baseTemp = 36.6,
  staleSeconds = 30,
  broadcast: Broadcast = () => {}
) {
  const device = await ensureSimulatorDevice(pool, userId);
  const count = Math.min(48, Math.max(10, Math.round(hours * 2.5)));
  const now = Date.now();
  const intervalMs = (hours * 3600 * 1000) / count;
  const sessionId = randomUUID();

  await transaction(pool, async (client) => {
    for (let i = count; i >= 0; i--) {
      const observedTime = new Date(now - i * intervalMs).toISOString();
      const seq = count - i + 1;
      // Slight physiological fluctuations
      const hrVariance = Math.round(5 * Math.sin(i * 0.45) + 3 * Math.cos(i * 0.8));
      const hr = Math.max(45, Math.min(180, baseHeartRate + hrVariance));
      const spo2Variance = Number((0.8 * Math.sin(i * 0.3)).toFixed(1));
      const spo2 = Math.max(75, Math.min(100, Number((baseSpo2 + spo2Variance).toFixed(1))));
      const tempVariance = Number((0.2 * Math.sin(i * 0.25)).toFixed(1));
      const temp = Number((baseTemp + tempVariance).toFixed(1));
      const ecgStatus = hr > 120 || hr < 50 ? 'Irregular' : 'Normal';

      await client.query(
        `INSERT INTO vitals (user_id, device_id, session_id, sequence, observed_at, source, heart_rate, spo2, temperature, ecg_status)
         VALUES ($1, $2, $3, $4, $5, 'BackOffice_Simulator', $6, $7, $8, $9)
         ON CONFLICT (device_id, session_id, sequence) DO NOTHING`,
        [userId, device.id, sessionId, seq, observedTime, hr, spo2, temp, ecgStatus]
      );
    }
  });

  // Trigger one current reading to set state fresh
  return simulateTelemetry(
    pool,
    userId,
    {
      heart_rate: baseHeartRate,
      spo2: baseSpo2,
      temperature: baseTemp,
      ecg_status: baseHeartRate > 100 || baseHeartRate < 55 ? 'Irregular' : 'Normal',
      generate_ecg_batch: true,
      source: 'BackOffice_Simulator',
    },
    staleSeconds,
    broadcast
  );
}

/** A bounded one-page text PDF; calculate object offsets from the actual bytes. */
function simulationPdf(lines: string[]): Buffer {
  const escape = (value: string) => value.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
  const stream = ['BT /F1 11 Tf 16 TL 50 740 Td', ...lines.map((line, i) => `${i ? 'T* ' : ''}(${escape(line)}) Tj`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /MediaBox [0 0 612 792] /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

/** Saves a labelled test-data summary, without inventing missing observations. */
export async function produceSimulationReport(
  pool: Pool,
  userId: number,
  reports: ReturnType<typeof reportStorage>
) {
  const stats = (await pool.query(`SELECT COUNT(*)::int AS total_readings,
    ROUND(AVG(heart_rate)::numeric,1)::float AS avg_hr,MIN(heart_rate) AS min_hr,MAX(heart_rate) AS max_hr,
    ROUND(AVG(spo2)::numeric,1)::float AS avg_spo2,MIN(spo2) AS min_spo2,
    ROUND(AVG(temperature)::numeric,1)::float AS avg_temp
    FROM vitals WHERE user_id=$1 AND source=$2 AND observed_at BETWEEN NOW()-INTERVAL '24 hours' AND NOW()`,
    [userId,SIMULATION_SOURCE])).rows[0];
  if (!stats?.total_readings) throw new HttpError(400, 'Generate simulation readings before creating a simulation report.');
  const generatedAt = new Date().toISOString();
  const lines = [
    'Vyana - Simulation telemetry summary',
    '',
    'GENERATED TEST DATA - NOT PHYSICAL SENSOR MEASUREMENTS',
    `Generated at: ${generatedAt}`,
    'Window: preceding 24 hours (UTC)',
    `Source: ${SIMULATION_SOURCE}`,
    `Recorded simulation observations: ${stats.total_readings}`,
    '',
    `Heart rate: mean ${stats.avg_hr} BPM, range ${stats.min_hr}-${stats.max_hr} BPM`,
    `SpO2: mean ${stats.avg_spo2}%, minimum ${stats.min_spo2}%`,
    `Temperature: mean ${stats.avg_temp} C`,
    '',
    'These values were generated by the back-office simulator.',
    'This summary contains no clinical assessment or AI review.',
    'Use physical measurements and qualified review for health decisions.',
  ];
  const pdfBytes = simulationPdf(lines);
  const documentInput = {data_base64:pdfBytes.toString('base64'),mime_type:'application/pdf' as const,
    filename:`Vyana_Simulation_Report_${generatedAt.slice(0,10)}.pdf`};
  const analysis = {
    source:'rules' as const,reason:null,retry_after_seconds:null,offline:true,
    disclaimer:'Generated test data only. No physical measurements or clinical assessment.',
    document_status:'readable' as const,
    summary:`Simulation summary of ${stats.total_readings} generated observations from the preceding 24 hours. Mean heart rate ${stats.avg_hr} BPM, mean SpO2 ${stats.avg_spo2}%, mean temperature ${stats.avg_temp} C.`,
    sections:[{title:'Simulation data',items:lines.slice(8,11)},{title:'Limits',items:lines.slice(12)}],
    discussion_points:[],
  };
  await reports.ensureCapacity(userId,pdfBytes.length);
  return reports.save(userId,documentInput,analysis);
}
