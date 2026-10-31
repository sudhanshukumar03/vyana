/** Wire contracts. All patient data is scoped by authenticated ownership. */
export interface AnswerSection { title: string; items: string[] }
export type AiFailureReason = 'not_configured' | 'configuration' | 'authentication' | 'permission' | 'quota' | 'timeout' |
  'network' | 'model_unavailable' | 'busy' | 'invalid_response' | 'safety' | 'unavailable';
export interface AiResponseMetadata { source: 'gemini' | 'rules' | 'fallback'; reason: AiFailureReason | null;
  retry_after_seconds: number | null; sections: AnswerSection[]; disclaimer: string; offline: boolean }
export interface ChatResponse extends AiResponseMetadata { reply: string }
export interface ReportResponse extends AiResponseMetadata { summary: string; discussion_points: string[];
  document_status: 'readable' | 'unreadable' | 'not_health_report' | 'not_reviewed' }
export interface Reading { id: number; device_id: string; session_id: string; sequence: number; timestamp: string; observed_at: string; received_at: string; source: string }
export interface VitalReading extends Reading { heart_rate: number; spo2: number; temperature: number; ecg_status: 'Normal' | 'Irregular' | 'Leads Off' | 'Unknown' }
export interface ActivityReading extends Reading { steps: number; distance_km: number; calories: number; active_minutes: number }
export interface DailyActivity { steps: number|null; distance_km: number|null; calories: number|null; active_minutes: number|null; timestamp: string; source?:string; calories_type?:'active'; metric_warnings?:string[] }
export interface HealthAlert { id: number; timestamp: string; severity: 'info' | 'warning' | 'critical'; title: string; detail: string; status: 'active' | 'resolved'; metric: string; direction: string; acknowledged_at: string | null; resolved_at: string | null }
export interface EquipmentSnapshot { observed_at: string; temperature_c: number | null;
  heart_rate?: number | null; spo2?: number | null;
  ecg_status: 'Leads Off' | 'Unknown'; ecg_raw_adc: number; ecg_millivolts: number;
  ecg_samples: number; ecg_clipped_samples: number }
export interface DeviceStatus { id: string; device_name: string; connected: boolean; battery: number | null; last_seen: string | null; source: string; active: boolean; equipment?: EquipmentSnapshot | null }
export interface HealthInsight { type: 'info' | 'warning' | 'success' | 'critical'; title: string; detail: string }
export interface InsightResponse { insights: HealthInsight[]; offline: boolean }
export interface Profile { id?: number; full_name?: string | null; dob?: string | null; sex?: string | null; height_cm?: number | null; weight_kg?: number | null; conditions?: string | null; medications?: string | null; allergies?: string | null; activity_level?: string | null; goal?: string | null; timezone?: string; onboarded: boolean;
  energy_activity?:'inactive'|'low_active'|'active'|'very_active'|null;nutrition_review?:'unknown'|'standard'|'required';weight_goal_type?:'maintain'|'reduce'|'gain';goal_weight_kg?:number|null }
export interface Contact { id: number; name: string; phone?: string | null; office_phone?: string|null; email?: string | null; relation?: string | null; is_doctor?: boolean }
export interface Freshness { state: 'fresh' | 'stale' | 'missing'; age_seconds: number | null; stale_seconds: number }
export interface HealthSummary { vitals: VitalReading | null; activity: DailyActivity | null; device: DeviceStatus | null; profile: Profile | null; alerts: HealthAlert[]; insights: HealthInsight[]; wellness_score: number | null; freshness: Freshness; server_time: string }
export type HealthUpdate = { type: 'vitals'; data: VitalReading } | { type: 'activity'; data: ActivityReading } | { type: 'device'; data: DeviceStatus };
