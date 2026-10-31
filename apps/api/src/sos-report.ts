import type {PoolClient} from 'pg';
import {hardwareSources} from './sos-policy';

export interface SosReport {
  name:string;reason:string;generated_at:string;period_start:string;period_end:string;timezone:string;
  device_name:string|null;latest:Record<string,unknown>|null;stats:Record<string,unknown>;
  rows:Record<string,unknown>[];total_readings:number;ecg_note:string;
}
export async function buildSosReport(client:PoolClient,userId:number,reason:string,at=new Date()):Promise<SosReport> {
  const start=new Date(at.getTime()-86400000).toISOString(),end=at.toISOString();
  const profile=(await client.query('SELECT full_name,timezone FROM profile WHERE user_id=$1',[userId])).rows[0];
  const device=(await client.query('SELECT id,device_name FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL',[userId])).rows[0];
  const args=[userId,device?.id||null,start,end,[...hardwareSources]];
  const stats=(await client.query(`SELECT COUNT(*)::int AS count,MIN(heart_rate) AS min_hr,MAX(heart_rate) AS max_hr,
    ROUND(AVG(heart_rate)::numeric,1)::float AS average_hr,MIN(spo2) AS min_spo2,
    MIN(temperature) AS min_temperature,MAX(temperature) AS max_temperature,
    COUNT(*) FILTER(WHERE heart_rate<40 OR heart_rate>150)::int AS heart_rate_alert_samples,
    COUNT(*) FILTER(WHERE spo2<88)::int AS oxygen_alert_samples,
    COUNT(*) FILTER(WHERE cardinality(quality)>0)::int AS sensor_quality_flags
    FROM sos_observations WHERE user_id=$1 AND device_id=$2 AND observed_at BETWEEN $3 AND $4 AND source=ANY($5::text[])`,args)).rows[0];
  stats.excluded_unverified_count=(await client.query(`SELECT COUNT(*)::int AS count FROM sos_observations
    WHERE user_id=$1 AND device_id=$2 AND observed_at BETWEEN $3 AND $4 AND NOT(source=ANY($5::text[]))`,args)).rows[0].count;
  const rows=(await client.query(`SELECT observed_at,heart_rate,spo2,temperature,ecg_status,quality,source,
      ecg_raw_adc,ecg_millivolts,ecg_samples,ecg_clipped_samples
    FROM sos_observations WHERE user_id=$1 AND device_id=$2 AND observed_at BETWEEN $3 AND $4 AND source=ANY($5::text[])
    ORDER BY observed_at DESC LIMIT 2000`,args)).rows;
  return {name:profile?.full_name||'Vyaana user',reason,generated_at:end,period_start:start,period_end:end,
    timezone:profile?.timezone||'Asia/Kolkata',device_name:device?.device_name||null,latest:rows[0]||null,
    stats,total_readings:stats.count,rows:rows.reverse(),
    ecg_note:'AD8232 readings describe input quality and lead contact. This firmware does not classify ECG rhythms. Sensor flags are not diagnoses.'};
}
export const escapeHtml=(value:unknown)=>String(value??'Unavailable').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reportText(report:SosReport) {
  return `Vyaana monitoring report\n${report.reason}\nPerson: ${report.name}\nPeriod: ${report.period_start} to ${report.period_end} (${report.timezone})\nDevice: ${report.device_name||'No active device'}\nRecorded hardware observations: ${report.total_readings}\nUnverified observations excluded: ${report.stats.excluded_unverified_count??0}\nHeart rate range: ${report.stats.min_hr??'Unavailable'} to ${report.stats.max_hr??'Unavailable'} bpm\nLowest oxygen: ${report.stats.min_spo2??'Unavailable'}%\nSensor quality flags: ${report.stats.sensor_quality_flags}\n${report.ecg_note}\nThis is a monitoring notification, not a confirmed medical emergency. Please contact the person to check on them.\n`;
}
export function reportHtml(report:SosReport) {
  return `<html><body style="font-family:Arial,sans-serif;color:#153d36;line-height:1.6;max-width:720px;margin:auto;padding:24px"><h1>Vyaana monitoring report</h1><p>${escapeHtml(report.reason)}</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(reportText(report))}</pre><p>CSV contains the most recent ${report.rows.length} of ${report.total_readings} observations. Summary statistics cover the entire recorded period. Temperature is the probe's local reading.</p></body></html>`;
}
export function reportCsv(report:SosReport) {
  const cell=(value:unknown)=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
  return ['observed_at,heart_rate_bpm,spo2_percent,probe_temperature_c,ecg_status,quality,source,ecg_raw_adc,ecg_millivolts,ecg_samples,ecg_clipped_samples',
    ...report.rows.map(row=>[row.observed_at instanceof Date?row.observed_at.toISOString():row.observed_at,
      row.heart_rate,row.spo2,row.temperature,row.ecg_status,(row.quality as string[]).join('; '),row.source,
      row.ecg_raw_adc,row.ecg_millivolts,row.ecg_samples,row.ecg_clipped_samples].map(cell).join(','))].join('\r\n');
}
