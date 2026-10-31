export type GoogleActivityMetric='active_calories_kcal'|'active_minutes';
export type GoogleTimelineMetric='steps'|'distance_km'|GoogleActivityMetric;
export interface GoogleActivityInterval {
  metric:GoogleTimelineMetric; start_time:string; end_time:string; value:number;
}
export interface GoogleActivityHour {
  start_time:string; end_time:string; steps:number|null; distance_km:number|null;
  active_calories_kcal:number|null; active_minutes:number|null;
}
export interface GoogleActivityTimeline {
  date:string; timezone:string; last_synced_at:string|null; metric_warnings:GoogleActivityMetric[];
  hours:GoogleActivityHour[]; intervals:GoogleActivityInterval[]; next_cursor:string|null;
  interval_count:number; unallocated_intervals:number;
}
export interface GoogleHealthDay {
  date:string; steps:number|null; distance_km:number|null;
  /** Optional for older cached/client fixtures; missing values remain unavailable. */
  active_calories_kcal?:number|null; active_minutes?:number|null;
  light_minutes?:number|null;moderate_minutes?:number|null;vigorous_minutes?:number|null;
}
export interface GoogleHealthOverview {
  provider:'GoogleHealth'; configured:boolean; connected:boolean; account_email:string|null;
  timezone:string; today:string; last_synced_at:string|null; last_attempt_at:string|null;
  error_code:string|null; days:GoogleHealthDay[];
  metric_warnings?:GoogleActivityMetric[];
}
