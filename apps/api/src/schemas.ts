import { z } from 'zod';

const integer = z.number().int().min(0).max(2147483647);
const source = z.string().trim().min(1).max(50);
const envelope = {
  session_id: z.uuid(), sequence: integer,
  observed_at: z.iso.datetime({ offset: true }).refine((value) => {
    const age = Date.now() - Date.parse(value);
    return age >= -300000 && age <= 31 * 86400000;
  }, 'Observation must be within the past 31 days and no more than five minutes in the future'),
  source,
};
export const vitalsSchema = z.object({ ...envelope, heart_rate: integer.max(300), spo2: z.number().min(0).max(100),
  temperature: z.number().min(20).max(45), ecg_status: z.enum(['Normal', 'Irregular', 'Leads Off', 'Unknown']) }).strict();
export const activitySchema = z.object({ ...envelope, steps: integer, distance_km: z.number().min(0).max(100000),
  calories: integer, active_minutes: integer }).strict();
export const deviceSchema = z.object({ device_name: z.string().trim().min(1).max(100), connected: z.boolean(),
  battery: integer.max(100).nullable(), source }).strict();
export const credentialsSchema = z.object({ email: z.email().trim().toLowerCase().max(255),
  password: z.string().min(8).max(72).refine(value=>Buffer.byteLength(value,'utf8')<=72, 'Password exceeds 72 UTF-8 bytes') }).strict();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const profileSchema = z.object({ full_name: optionalText(100),
  dob: z.iso.date().refine((value) => value <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future').nullable().optional(),
  sex: z.enum(['male','female','other']).nullable().optional(), height_cm: z.number().min(50).max(250).optional(),
  weight_kg: z.number().min(20).max(300).optional(), conditions: optionalText(2000), medications: optionalText(2000),
  allergies: optionalText(2000), activity_level: z.enum(['sedentary','light','moderate','active']).nullable().optional(),
  goal: optionalText(100), timezone: z.string().max(100).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }).optional(),
}).strict();
export const contactSchema = z.object({ name: z.string().trim().min(1).max(100), phone: optionalText(32),
  email: z.email().max(120).nullable().optional(), relation: optionalText(50), is_doctor: z.boolean().default(false),
}).strict().refine((contact) => Boolean(contact.phone || contact.email), 'Provide a phone number or email');
export const chatSchema = z.object({ message: z.string().trim().min(1).max(4000), history: z.array(z.object({
  role: z.enum(['user','assistant']), content: z.string().max(8000) }).strict()).max(16).default([]) }).strict();
export const reportSchema = z.object({ data_base64: z.string().min(1).max(13981016),
  mime_type: z.enum(['application/pdf','image/png','image/jpeg']), filename: z.string().max(255).default('') }).strict();
export const insightSchema = z.object({ type: z.enum(['info','warning','success','critical']), title: z.string().max(120), detail: z.string().max(2000) });
export const insightsSchema = z.object({ insights: z.array(insightSchema).min(1).max(8), offline: z.boolean().default(true) });
export function bmi(profile: { height_cm?: number; weight_kg?: number; dob?: string | Date }) {
  if (!profile.height_cm || !profile.weight_kg) return null;
  const raw = profile.weight_kg / (profile.height_cm / 100) ** 2;
  const adult = profile.dob && new Date(profile.dob) <= new Date(new Date().setFullYear(new Date().getFullYear() - 20));
  return { value: Math.round(raw * 10) / 10, category: adult ?
    (raw < 18.5 ? 'Underweight' : raw < 25 ? 'Normal' : raw < 30 ? 'Overweight' : 'Obese') : 'Not classified', adult: Boolean(adult) };
}
export function validateReport(data: z.infer<typeof reportSchema>) {
  if (data.data_base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(data.data_base64)) throw new Error('Invalid base64 report');
  const bytes = Buffer.from(data.data_base64, 'base64');
  if (bytes.toString('base64') !== data.data_base64) throw new Error('Invalid base64 report');
  if (bytes.length > 10 * 1024 * 1024) throw Object.assign(new Error('File too large (maximum 10 MiB)'), { status: 413 });
  const valid = data.mime_type === 'application/pdf' ? bytes.subarray(0,5).toString() === '%PDF-' :
    data.mime_type === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error('File content does not match its type');
}
