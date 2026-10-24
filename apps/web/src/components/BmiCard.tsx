import { useHealthStore } from '../store/useHealthStore';
import { computeBmi, healthyWeightRange, type BmiCategory } from '../lib/bmi';
import { Scale } from 'lucide-react';

const CAT: Record<BmiCategory, { badge: string; tip: string }> = {
  under: { badge: 'bg-warn-bg text-warn', tip: 'A nutrient-dense diet with some strength work can help you build up healthily.' },
  normal: { badge: 'bg-success-bg text-success', tip: 'You’re in the healthy range — keep up your current habits and stay active.' },
  over: { badge: 'bg-warn-bg text-warn', tip: 'A gradual calorie deficit and about 2,000 extra steps a day can bring this down.' },
  obese: { badge: 'bg-critical-bg text-critical', tip: 'Consider a structured plan and a check-in with a healthcare professional.' },
};

export function BmiCard() {
  const { profile, setShowOnboarding } = useHealthStore();
  const bmi = computeBmi(profile?.height_cm, profile?.weight_kg);
  const adult = Boolean(profile?.dob && new Date(profile.dob) <= new Date(new Date().setFullYear(new Date().getFullYear() - 20)));
  const range = adult ? healthyWeightRange(profile?.height_cm) : null;

  return (
    <div className="bg-surface rounded-2xl p-6 border border-line flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="w-5 h-5 text-muted" />
        <h3 className="text-[16px] font-semibold text-ink">Body Mass Index</h3>
      </div>

      {!bmi ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <p className="text-muted text-sm mb-4">Add your height and weight to see your BMI.</p>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="text-[14px] font-semibold text-brand hover:text-brand-hover rounded-lg px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Complete your profile
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex items-end gap-3 mb-3">
            <span className="text-[40px] font-semibold text-ink leading-none tabular-nums">{bmi.value}</span>
            <span className={`mb-1 text-[12px] font-semibold px-2.5 py-1 rounded-full ${CAT[bmi.category].badge}`}>{adult ? bmi.label : 'Numeric calculation only'}</span>
          </div>
          {range && (
            <p className="text-[12px] text-muted mb-3">
              Healthy weight for your height: <span className="font-medium text-body">{range[0]}–{range[1]} kg</span>
            </p>
          )}
          <p className="text-[13px] text-body leading-snug mt-auto">{adult ? CAT[bmi.category].tip : 'Adult categories and weight targets are unavailable for younger users or an unknown age. Consult a qualified clinician for interpretation.'}</p>
        </div>
      )}
    </div>
  );
}
