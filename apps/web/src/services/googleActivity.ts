import type {GoogleHealthOverview} from '../../../../shared/types/google-health';
import type {DailyActivity} from '../../../../shared/types/health';

/** One canonical recorded-day projection for cards, state and loaded exports. */
export function activityFromGoogle(google:GoogleHealthOverview|null):DailyActivity|null {
  const day=google?.days.find(record=>record.date===google.today);
  if(!google?.connected||!day||[day.steps,day.distance_km,day.active_calories_kcal,day.active_minutes].every(value=>value==null))return null;
  return {steps:day.steps,distance_km:day.distance_km,calories:day.active_calories_kcal??null,active_minutes:day.active_minutes??null,calories_type:'active',metric_warnings:google.metric_warnings??[],
    timestamp:google.last_synced_at??'',source:'GoogleHealth'};
}
