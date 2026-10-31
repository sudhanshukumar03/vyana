import { Modal } from '../Modal';
import { useState } from 'react';
import { useHealthStore } from '../../store/useHealthStore';
import { HeartPulse, X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { computeBmi, healthyWeightRange } from '../../lib/bmi';

type Form = {
  full_name: string;
  dob: string;
  sex: string;
  height_cm: string;
  weight_kg: string;
  activity_level: string;
  goal: string;
  conditions: string;
  medications: string;
  allergies: string;
  timezone: string;
};

const STEPS = [
  { id: 'basics', title: 'Basics' },
  { id: 'body', title: 'Body Dimensions' },
  { id: 'lifestyle', title: 'Lifestyle & Clinical' },
];

export function Onboarding() {
  const { saveProfile, profile, setShowOnboarding } = useHealthStore();
  const canClose = Boolean(profile?.onboarded);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form>({
    full_name: profile?.full_name ?? '',
    dob: profile?.dob ? String(profile.dob).slice(0, 10) : '',
    sex: profile?.sex ? String(profile.sex).toLowerCase() : '',
    height_cm: profile?.height_cm != null ? String(profile.height_cm) : '',
    weight_kg: profile?.weight_kg != null ? String(profile.weight_kg) : '',
    activity_level: profile?.activity_level ?? '',
    goal: profile?.goal ?? '',
    conditions: profile?.conditions ?? '',
    medications: profile?.medications ?? '',
    allergies: profile?.allergies ?? '',
    timezone: profile?.timezone ?? 'Asia/Kolkata',
  });

  const patch = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const h = parseFloat(form.height_cm);
  const w = parseFloat(form.weight_kg);
  const bodyValid = h >= 50 && h <= 250 && w >= 20 && w <= 300;
  const canNext = step === 1 ? bodyValid : true;
  const bmiInfo = bodyValid ? computeBmi(h, w) : null;
  const weightBand = bodyValid ? healthyWeightRange(h) : null;

  const finish = async () => {
    if (!bodyValid) {
      setStep(1);
      return;
    }
    setSaving(true);
    setError('');
    const ok = await saveProfile({
      full_name: form.full_name || null,
      dob: form.dob || null,
      sex: (form.sex || null) as Form['sex'] | null,
      height_cm: h,
      weight_kg: w,
      activity_level: (form.activity_level || null) as Form['activity_level'] | null,
      goal: form.goal || null,
      conditions: form.conditions || null,
      medications: form.medications || null,
      allergies: form.allergies || null,
      timezone: form.timezone,
    });
    setSaving(false);
    if (!ok) setError(useHealthStore.getState().error || 'Could not save your profile. Please retry.');
  };

  const inputClass =
    'w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all shadow-2xs';
  const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5';

  return (
    <Modal title="Health profile" dismissible={canClose} onClose={() => setShowOnboarding(false)}>
      <div className="w-full max-w-lg bg-surface rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
        {/* 1. Fixed Header matching Vyana Brand Identity */}
        <div className="relative shrink-0 bg-gradient-to-br from-[#182633] via-[#0F1E36] to-[#0A1526] px-6 pt-6 pb-5 text-white border-b border-white/10">
          {canClose && (
            <button
              type="button"
              onClick={() => setShowOnboarding(false)}
              aria-label="Close"
              className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="w-11 h-11 rounded-2xl bg-brand/20 border border-brand/40 text-sky-400 flex items-center justify-center mb-3 shadow-inner">
            <HeartPulse className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-extrabold font-display tracking-tight text-white">
            Let's get to know you
          </h2>
          <p className="text-slate-300 text-xs mt-1">
            A few clinical details so Vyana can calibrate vitals baselines and personalize emergency triage.
          </p>
        </div>

        {/* 2. Fixed Step Progress Bar (Never scrolls) */}
        <div className="shrink-0 bg-surface-soft/60 px-6 py-3.5 border-b border-line flex items-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < step ? 'bg-emerald-500' : i === step ? 'bg-brand' : 'bg-line'
                }`}
              />
              <div className="flex items-center gap-1 mt-1.5">
                {i < step && <Check className="w-3 h-3 text-emerald-600 shrink-0" />}
                <p
                  className={`text-[10.5px] font-bold tracking-tight truncate ${
                    i === step ? 'text-brand' : i < step ? 'text-emerald-700' : 'text-muted'
                  }`}
                >
                  {s.title}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 3. Smooth Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[50vh]">
          {/* STEP 0: Basics */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="ob-name">
                  Full name
                </label>
                <input
                  id="ob-name"
                  className={inputClass}
                  value={form.full_name}
                  onChange={(e) => patch('full_name', e.target.value)}
                  placeholder="e.g. Alex Kumar"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="ob-dob">
                  Date of birth
                </label>
                <input
                  id="ob-dob"
                  type="date"
                  className={inputClass}
                  value={form.dob}
                  onChange={(e) => patch('dob', e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="ob-sex">
                  Biological Sex
                </label>
                <select
                  id="ob-sex"
                  className={inputClass}
                  value={form.sex}
                  onChange={(e) => patch('sex', e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <p className="text-[11px] text-muted mt-1">Used for accurate cardiac &amp; respiratory baseline norms.</p>
              </div>
            </div>
          )}

          {/* STEP 1: Body Dimensions */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="ob-h">
                    Height (cm) *
                  </label>
                  <input
                    id="ob-h"
                    type="number"
                    inputMode="decimal"
                    className={inputClass}
                    value={form.height_cm}
                    onChange={(e) => patch('height_cm', e.target.value)}
                    placeholder="175"
                  />
                  <span className="text-[11px] text-muted block mt-1">Range: 50 – 250 cm</span>
                </div>

                <div>
                  <label className={labelClass} htmlFor="ob-w">
                    Weight (kg) *
                  </label>
                  <input
                    id="ob-w"
                    type="number"
                    inputMode="decimal"
                    className={inputClass}
                    value={form.weight_kg}
                    onChange={(e) => patch('weight_kg', e.target.value)}
                    placeholder="72"
                  />
                  <span className="text-[11px] text-muted block mt-1">Range: 20 – 300 kg</span>
                </div>
              </div>

              {!bodyValid && (form.height_cm !== '' || form.weight_kg !== '') && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  Please enter a valid height (50–250 cm) and weight (20–300 kg) to calculate your BMI.
                </div>
              )}

              {bodyValid && bmiInfo ? (
                <div className="p-3.5 rounded-2xl bg-surface-soft/80 border border-line flex items-center justify-between text-xs transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center font-bold font-mono text-sm shrink-0">
                      {bmiInfo.value.toFixed(1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">Body Mass Index (BMI)</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            bmiInfo.category === 'normal'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : bmiInfo.category === 'under'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : bmiInfo.category === 'over'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {bmiInfo.label}
                        </span>
                      </div>
                      {weightBand && (
                        <p className="text-[11px] text-muted mt-0.5">
                          Healthy weight reference: {weightBand[0]} – {weightBand[1]} kg
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted">
                  Used to calculate your Body Mass Index (BMI) and healthy reference range.
                </p>
              )}
            </div>
          )}

          {/* STEP 2: Lifestyle & Clinical */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="ob-act">
                    Activity level
                  </label>
                  <select
                    id="ob-act"
                    className={inputClass}
                    value={form.activity_level}
                    onChange={(e) => patch('activity_level', e.target.value)}
                  >
                    <option value="">Select activity…</option>
                    <option value="sedentary">Sedentary (desk job, minimal exercise)</option>
                    <option value="light">Lightly active (1-2 walks/week)</option>
                    <option value="moderate">Moderately active (3-5 workouts/week)</option>
                    <option value="active">Very active (daily heavy training)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="ob-goal">
                    Primary health goal
                  </label>
                  <input
                    id="ob-goal"
                    className={inputClass}
                    value={form.goal}
                    onChange={(e) => patch('goal', e.target.value)}
                    placeholder="e.g. 10,000 steps, Cardio Fitness"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="ob-cond">
                  Conditions or Diagnoses (optional)
                </label>
                <textarea
                  id="ob-cond"
                  rows={2}
                  className={`${inputClass} resize-none`}
                  value={form.conditions}
                  onChange={(e) => patch('conditions', e.target.value)}
                  placeholder="e.g. Asthma, Hypertension, Arrhythmia"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="ob-med">
                    Medications (optional)
                  </label>
                  <textarea
                    id="ob-med"
                    rows={2}
                    className={`${inputClass} resize-none`}
                    maxLength={2000}
                    value={form.medications}
                    onChange={(e) => patch('medications', e.target.value)}
                    placeholder="e.g. Beta-blockers, Inhaler"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="ob-allergy">
                    Allergies (optional)
                  </label>
                  <textarea
                    id="ob-allergy"
                    rows={2}
                    className={`${inputClass} resize-none`}
                    maxLength={2000}
                    value={form.allergies}
                    onChange={(e) => patch('allergies', e.target.value)}
                    placeholder="e.g. Penicillin, Latex"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="ob-timezone">
                  Activity Timezone
                </label>
                <input
                  id="ob-timezone"
                  className={inputClass}
                  value={form.timezone}
                  onChange={(e) => patch('timezone', e.target.value)}
                  placeholder="Asia/Kolkata"
                />
                <p className="text-[11px] text-muted mt-1">Daily step milestones calibrate against this IANA timezone.</p>
              </div>
            </div>
          )}

          {error && <p role="alert" className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200">{error}</p>}
        </div>

        {/* 4. Fixed Footer (Never scrolls) */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-line bg-surface">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-line text-slate-700 transition-colors disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-brand hover:bg-brand-hover text-white shadow-xs transition-all disabled:opacity-50"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50"
            >
              <span>{saving ? 'Saving…' : 'Finish Setup'}</span>
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
