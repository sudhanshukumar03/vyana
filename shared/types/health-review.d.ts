export type EnergyActivity='inactive'|'low_active'|'active'|'very_active';
export interface BodyReview {
  age_years:number|null;bmi:number|null;bmi_category:string|null;reference_kg:[number,number]|null;
  maintenance_kcal:number|null;energy_status:'ready'|'profile_needed'|'age_restricted'|'review_required';
  reasons:string[];model:'DRI-EER-2023';energy_activity:EnergyActivity|null;
  goal_type:'maintain'|'reduce'|'gain';goal_weight_kg:number|null;current_weight_kg:number|null;
}
export interface ReviewFact {id:string;title:string;detail:string}
export interface HealthReview {
  generated_at:string;timezone:string;today:string;body:BodyReview;
  weights:{id:string;weight_kg:number;observed_at:string;source:string}[];
  activity:{connected:boolean;last_synced_at:string|null;warnings:string[];
    feeds:{feed:string;last_success_at:string|null;error_code:string|null}[];
    period:{start:string;end:string};previous_period:{start:string;end:string};
    movement_days:number;recorded_days:number;steps:number|null;distance_km:number|null;active_minutes:number|null;active_calories_kcal:number|null;
    comparison:{status:'ready'|'insufficient'|'zero_baseline'|'refresh_failed';step_delta:number|null;step_percent:number|null;previous_steps:number|null};
    recurring:{hour:number;days:number;recorded_days:number;active_minutes:number|null}[];
    intensity:{light:number|null;moderate:number|null;vigorous:number|null};
    exercises:{start_time:string;end_time:string;type:string;source:string}[];
    matches:{observed_at:string;heart_rate:number;activity_start:string;activity_end:string;source:string}[];
  };
  facts:ReviewFact[];
}
