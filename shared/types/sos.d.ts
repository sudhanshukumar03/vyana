/** Shared SOS wire contracts; this module contains no runtime code. */
export interface SosPreferences {
  sharing_enabled: boolean;
  auto_enabled: boolean;
  daily_report_enabled: boolean;
  fault_report_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  call_enabled: boolean;
  attach_report: boolean;
  emergency_contact_ids: number[];
  report_contact_ids: number[];
  critical_seconds: number;
  minimum_samples: number;
  cancel_seconds: number;
  cooldown_minutes: number;
  daily_hour: number;
}
export interface SosCapabilities { email: boolean; sms: boolean; call: boolean; phone_sos: false }
export interface SosNotification {
  id: string; contact_name: string; channel: 'email'|'sms'|'call';
  status: 'pending'|'blocked'|'sending'|'submitted'|'failed'|'unknown'|'cancelled';
  error_code: string|null;
}
export interface SosIncident {
  id: string; kind: 'manual'|'automatic'|'daily'|'sensor_fault';
  status: 'pending'|'queued'|'cancelled'|'recorded'|'processed'; reason: string;
  created_at: string; due_at: string; notifications: SosNotification[];
}
export interface SosOverview {
  preferences: SosPreferences; capabilities: SosCapabilities; incidents: SosIncident[];
  timezone: string; server_time: string;
}
export interface ManualSosResult {
  sos_incident_id: string;
  notification_count: number;
  delivery_status: 'recorded'|'queued'|'setup_required';
}
