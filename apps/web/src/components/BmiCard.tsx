import { useHealthStore } from '../store/useHealthStore';
import { ageFromBirthDate, computeBmi, healthyWeightRange, type BmiCategory } from '../lib/bmi';
import { Info, CheckCircle2, ArrowRight } from 'lucide-react';
import { WeightScaleIcon } from './WeightScaleIcon';

interface SegmentDef {
  label: string;
  range: string;
  color: string;
  startAngle: number;
  endAngle: number;
}

const SEGMENTS: SegmentDef[] = [
  { label: 'Underweight', range: '< 18.5', color: '#38BDF8', startAngle: 180, endAngle: 156.2 },
  { label: 'Normal', range: '18.5 – 24.9', color: '#10B981', startAngle: 153.7, endAngle: 109.5 },
  { label: 'Overweight', range: '25.0 – 29.9', color: '#FBBF24', startAngle: 107.0, endAngle: 73.0 },
  { label: 'Obese I', range: '30.0 – 34.9', color: '#FB923C', startAngle: 70.5, endAngle: 36.5 },
  { label: 'Obese II+', range: '≥ 35.0', color: '#EF4444', startAngle: 34.0, endAngle: 0.0 },
];

function describeArc(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const a1 = toRad(startAngleDeg);
  const a2 = toRad(endAngleDeg);

  const x1Outer = cx + rOuter * Math.cos(a1);
  const y1Outer = cy - rOuter * Math.sin(a1);
  const x2Outer = cx + rOuter * Math.cos(a2);
  const y2Outer = cy - rOuter * Math.sin(a2);

  const x1Inner = cx + rInner * Math.cos(a2);
  const y1Inner = cy - rInner * Math.sin(a2);
  const x2Inner = cx + rInner * Math.cos(a1);
  const y2Inner = cy - rInner * Math.sin(a1);

  return [
    `M ${x1Outer.toFixed(2)} ${y1Outer.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${x2Outer.toFixed(2)} ${y2Outer.toFixed(2)}`,
    `L ${x1Inner.toFixed(2)} ${y1Inner.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 0 0 ${x2Inner.toFixed(2)} ${y2Inner.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function getBmiAngle(bmi: number): number {
  if (bmi <= 15) return 180;
  if (bmi >= 40) return 0;
  if (bmi < 18.5) return 180 - ((bmi - 15) / 3.5) * 23.8;
  if (bmi < 25) return 153.7 - ((bmi - 18.5) / 6.5) * 44.2;
  if (bmi < 30) return 107.0 - ((bmi - 25) / 5.0) * 34.0;
  if (bmi < 35) return 70.5 - ((bmi - 30) / 5.0) * 34.0;
  return 34.0 - ((bmi - 35) / 5.0) * 34.0;
}

const CAT_CONFIG: Record<
  BmiCategory,
  {
    badgeBg: string;
    badgeText: string;
    color: string;
    border: string;
    headline: string;
    tip: string;
  }
> = {
  under: {
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    color: '#38BDF8',
    border: 'border-sky-200',
    headline: 'Underweight Range',
    tip: 'Your BMI is below the standard reference range. Consider nutrient-dense dietary planning or consulting your primary clinician.',
  },
  normal: {
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    color: '#10B981',
    border: 'border-emerald-200',
    headline: 'Optimal Healthy Weight',
    tip: 'Within the optimal adult reference range. Continue balanced activity, hydration, and cardiovascular exercise to maintain stability.',
  },
  over: {
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    color: '#FBBF24',
    border: 'border-amber-200',
    headline: 'Overweight Range',
    tip: 'Slightly elevated relative to height. Gradual caloric moderation and progressive daily steps can assist healthy weight management.',
  },
  obese: {
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    color: '#EF4444',
    border: 'border-rose-200',
    headline: 'Clinical Attention Suggested',
    tip: 'Elevated BMI is associated with metabolic and cardiovascular risk factors. Review personalized lifestyle targets with your clinician.',
  },
};

export function BmiCard() {
  const { profile, setShowOnboarding } = useHealthStore();
  const bmi = computeBmi(profile?.height_cm, profile?.weight_kg);
  const age = ageFromBirthDate(profile?.dob, profile?.timezone);
  const adult = age !== null && age >= 20;
  const range = adult ? healthyWeightRange(profile?.height_cm) : null;

  const currentAngle = bmi ? getBmiAngle(bmi.value) : 109.5;
  const currentCategory = bmi ? CAT_CONFIG[bmi.category] : CAT_CONFIG.normal;

  // Pointer geometry
  const cx = 160;
  const cy = 150;
  const rInner = 82;
  const rOuter = 120;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const needleRad = toRad(currentAngle);
  const tipX = cx + (rInner - 2) * Math.cos(needleRad);
  const tipY = cy - (rInner - 2) * Math.sin(needleRad);
  const baseLeftX = cx + (rInner - 16) * Math.cos(toRad(currentAngle + 6));
  const baseLeftY = cy - (rInner - 16) * Math.sin(toRad(currentAngle + 6));
  const baseRightX = cx + (rInner - 16) * Math.cos(toRad(currentAngle - 6));
  const baseRightY = cy - (rInner - 16) * Math.sin(toRad(currentAngle - 6));

  const ticks = [
    { value: '15.0', angle: 180 },
    { value: '18.5', angle: 155 },
    { value: '25.0', angle: 108 },
    { value: '30.0', angle: 72 },
    { value: '35.0', angle: 35 },
    { value: '40.0', angle: 0 },
  ];

  return (
    <section
      className="surface p-4 sm:p-5 rounded-2xl border border-line bg-surface flex flex-col justify-between shadow-xs"
      aria-labelledby="bmi-title"
    >
      {/* Header */}
      <div className="pb-3 border-b border-line mb-3">
        <h2 id="bmi-title" className="text-sm font-bold text-ink">
          Body Mass Index (BMI)
        </h2>
        <p className="text-xs text-muted">Height-to-weight clinical reference gauge</p>
      </div>

      {!bmi ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-soft border border-line flex items-center justify-center text-muted mb-3">
            <WeightScaleIcon className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-ink mb-1">Measurements Needed</h3>
          <p className="text-xs text-muted max-w-xs mb-4">
            Add your height and weight in your profile to compute your calibrated BMI gauge and reference weight range.
          </p>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-brand hover:bg-brand-hover text-white shadow-xs transition-all"
          >
            <span>Complete Profile Dimensions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* Semicircular Gauge SVG */}
          <div className="relative w-full max-w-[280px] sm:max-w-[300px] aspect-[320/195] mx-auto select-none">
            <svg
              viewBox="0 0 320 195"
              className="w-full h-full overflow-visible"
              aria-label={`BMI gauge showing ${bmi.value} ${bmi.label}`}
            >
              {/* Colored Segments */}
              {SEGMENTS.map((seg) => (
                <path
                  key={seg.label}
                  d={describeArc(cx, cy, rInner, rOuter, seg.startAngle, seg.endAngle)}
                  fill={seg.color}
                  className="transition-all duration-300 hover:opacity-90"
                />
              ))}

              {/* Threshold Ticks & Values */}
              {ticks.map((t) => {
                const rText = rOuter + 14;
                const a = toRad(t.angle);
                const tx = cx + rText * Math.cos(a);
                const ty = cy - rText * Math.sin(a);
                return (
                  <text
                    key={t.value}
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[10px] font-mono font-bold fill-slate-500 select-none"
                  >
                    {t.value}
                  </text>
                );
              })}

              {/* Dynamic Needle / Arrow Pointer */}
              <polygon
                points={`${tipX.toFixed(1)},${tipY.toFixed(1)} ${baseLeftX.toFixed(1)},${baseLeftY.toFixed(
                  1
                )} ${baseRightX.toFixed(1)},${baseRightY.toFixed(1)}`}
                fill="#0F172A"
                className="transition-all duration-500 ease-out drop-shadow-sm"
              />

              {/* Center Readout */}
              <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                className="font-extrabold text-[38px] tracking-tight font-display select-none"
                fill={currentCategory.color}
              >
                {bmi.value.toFixed(1)}
              </text>
              <text
                x={cx}
                y={cy + 14}
                textAnchor="middle"
                className="font-extrabold text-[13px] uppercase tracking-wider select-none"
                fill={currentCategory.color}
              >
                {bmi.label}
              </text>
            </svg>
          </div>

          {/* Reference Weight Callout */}
          {range && (
            <div className="w-full mt-3 p-2.5 rounded-xl bg-surface-soft/80 border border-line flex items-center justify-between text-xs">
              <span className="text-muted flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Healthy Weight Target:
              </span>
              <span className="font-bold text-ink font-mono text-sm">
                {range[0]} – {range[1]} kg
              </span>
            </div>
          )}

          {/* Clinical Context Note */}
          <div className="w-full mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2 text-xs text-slate-600 leading-snug">
            <Info className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
            <p>
              {adult
                ? currentCategory.tip
                : 'Adult BMI categories and targets are calibrated for ages 20+. For pediatric or adolescent interpretation, consult your pediatrician.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
