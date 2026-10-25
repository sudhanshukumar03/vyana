import { Modal } from '../Modal';
import { useState } from 'react';
import { useHealthStore } from '../../store/useHealthStore';
import { HeartPulse, X } from 'lucide-react';

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

const STEPS = ['Basics', 'Body', 'Lifestyle'];

export function Onboarding() {
  const { saveProfile, profile, setShowOnboarding } = useHealthStore();
  const canClose = !!profile?.onboarded;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form>({
    full_name: profile?.full_name ?? '',
    dob: profile?.dob ? String(profile.dob).slice(0, 10) : '',
    sex: profile?.sex ?? '',
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

  const finish = async () => {
    if (!bodyValid) { setStep(1); return; }
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

  const input = 'ui-input';
  const label = 'field-label';

  return (
    <Modal title="Health profile" dismissible={canClose} onClose={() => setShowOnboarding(false)}>
      <div className="profile-dialog-panel w-full max-w-md bg-surface rounded-3xl">
        <div className="profile-dialog-header relative shrink-0 bg-[#073f35] px-6 pt-7 pb-6 text-white">
          {canClose && (
            <button type="button" onClick={() => setShowOnboarding(false)} aria-label="Close"
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="profile-dialog-symbol w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
            <HeartPulse className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold leading-tight">Let's get to know you</h2>
          <p className="text-white/80 text-[13px] mt-1">A few quick details so Vyana can personalise your insights.</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 px-6 pt-5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-brand' : 'bg-line'}`} />
              <p className={`text-[11px] mt-1.5 font-medium ${i === step ? 'text-ink' : 'text-muted'}`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="profile-dialog-body px-6 py-5 space-y-4">
          {step === 0 && (
            <>
              <div>
                <label className={label} htmlFor="ob-name">Full name</label>
                <input id="ob-name" className={input} value={form.full_name} onChange={(e) => patch('full_name', e.target.value)} placeholder="e.g. Alex Kumar" />
              </div>
              <div>
                <label className={label} htmlFor="ob-dob">Date of birth</label>
                <input id="ob-dob" type="date" className={input} value={form.dob} onChange={(e) => patch('dob', e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <label className={label} htmlFor="ob-sex">Sex</label>
                <select id="ob-sex" className={input} value={form.sex} onChange={(e) => patch('sex', e.target.value)}>
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className={label} htmlFor="ob-h">Height (cm)</label>
                <input id="ob-h" type="number" inputMode="decimal" className={input} value={form.height_cm} onChange={(e) => patch('height_cm', e.target.value)} placeholder="175" />
              </div>
              <div>
                <label className={label} htmlFor="ob-w">Weight (kg)</label>
                <input id="ob-w" type="number" inputMode="decimal" className={input} value={form.weight_kg} onChange={(e) => patch('weight_kg', e.target.value)} placeholder="72" />
              </div>
              {!bodyValid && (form.height_cm !== '' || form.weight_kg !== '') && (
                <p className="text-[12px] text-warn">Enter height 50–250 cm and weight 20–300 kg.</p>
              )}
              <p className="text-[12px] text-muted">Used to calculate your BMI and tailor guidance.</p>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className={label} htmlFor="ob-act">Activity level</label>
                <select id="ob-act" className={input} value={form.activity_level} onChange={(e) => patch('activity_level', e.target.value)}>
                  <option value="">Select…</option>
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Lightly active</option>
                  <option value="moderate">Moderately active</option>
                  <option value="active">Very active</option>
                </select>
              </div>
              <div>
                <label className={label} htmlFor="ob-goal">Primary goal</label>
                <input id="ob-goal" className={input} value={form.goal} onChange={(e) => patch('goal', e.target.value)} placeholder="e.g. 10,000 steps a day" />
              </div>
              <div>
                <label className={label} htmlFor="ob-cond">Conditions or other notes (optional)</label>
                <textarea id="ob-cond" rows={2} className={input} value={form.conditions} onChange={(e) => patch('conditions', e.target.value)} placeholder="e.g. asthma, penicillin allergy" />
              </div>
            </>
          )}

          {step === 2 && <>
            <div><label className={label} htmlFor="ob-med">Medications (optional)</label><textarea id="ob-med" rows={2} className={input} maxLength={2000} value={form.medications} onChange={event => patch('medications', event.target.value)} /></div>
            <div><label className={label} htmlFor="ob-allergy">Allergies (optional)</label><textarea id="ob-allergy" rows={2} className={input} maxLength={2000} value={form.allergies} onChange={event => patch('allergies', event.target.value)} /></div>
            <div><label className={label} htmlFor="ob-timezone">Activity timezone</label><input id="ob-timezone" className={input} value={form.timezone} onChange={event => patch('timezone', event.target.value)} placeholder="Asia/Kolkata" /><p className="text-xs text-muted">Daily activity uses this IANA timezone.</p></div>
          </>}
          {error && <p role="alert" className="text-[13px] text-critical">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-between px-6 py-4 border-t border-line">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="text-[14px] font-medium text-muted hover:text-ink disabled:opacity-0 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext}
              className="bg-brand text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Next</button>
          ) : (
            <button type="button" onClick={finish} disabled={saving}
              className="bg-brand text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{saving ? 'Saving…' : 'Finish'}</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
