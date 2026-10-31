import {
  User,
  Pencil,
  Ruler,
  Flame,
  Target,
  Stethoscope,
  Calendar,
  ShieldCheck,
  ArrowRight,
  Clock,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { WeightScaleIcon } from '../components/WeightScaleIcon';
import { useHealthStore } from '../store/useHealthStore';
import { BmiCard } from '../components/BmiCard';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';

function ageFromDob(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '—';
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 150 ? `${age} yrs` : '—';
}

function formatDob(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function cmToFeetInches(cm?: number | null): string | null {
  if (!cm) return null;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}′ ${inches}″`;
}

function kgToLbs(kg?: number | null): string | null {
  if (!kg) return null;
  return `${Math.round(kg * 2.20462 * 10) / 10} lbs`;
}

export default function Profile() {
  const { profile, user, setShowOnboarding, contacts, fetchContacts } = useHealthStore();
  const onboarded = Boolean(profile?.onboarded);

  useEffect(() => {
    if (contacts.length === 0) void fetchContacts();
  }, [contacts.length, fetchContacts]);

  const cap = (s?: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '—');

  // Professional patient display name with fallback to account identity
  const patientName =
    profile?.full_name?.trim() ||
    (user?.email
      ? user.email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Patient Record');

  const initials =
    patientName
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'PR';

  const feetInches = cmToFeetInches(profile?.height_cm);
  const lbs = kgToLbs(profile?.weight_kg);

  return (
    <div className="page-stack max-w-6xl mx-auto w-full space-y-7">
      <h1 className="sr-only">Profile</h1>

      {onboarded ? (
        <div className="space-y-7">
          {/* 1. Full-Width Executive Patient Hero Banner */}
          <section
            className="surface p-6 sm:p-8 rounded-3xl border border-line bg-surface shadow-xs relative overflow-hidden"
            aria-label="Personal Identity Card"
          >
            {/* Ambient medical gradient sheen */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-brand/8 via-cyan-400/5 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              {/* Left: Avatar + Identity */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-br from-[#0F1E36] via-[#1E3A8A] to-[#2E62DE] text-white flex items-center justify-center font-black text-2xl sm:text-3xl font-display shadow-lg shadow-brand/20 border border-white/20">
                    {initials}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4" title="Active Profile">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 ring-2 ring-white shadow-xs" />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
                      {patientName}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified Account</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted font-medium mb-3">
                    <span>{user?.email || 'Personal Health Profile'}</span>
                  </div>

                  {/* Demographics Bar */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-soft/80 border border-line font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>
                        {profile?.dob ? (
                          <>
                            <strong className="text-ink font-bold">{ageFromDob(profile.dob)}</strong>{' '}
                            <span className="text-muted text-[11px]">({formatDob(profile.dob)})</span>
                          </>
                        ) : (
                          <span className="text-muted">DOB: Not specified</span>
                        )}
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-soft/80 border border-line font-medium text-slate-700">
                      <User className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>
                        {profile?.sex ? (
                          <>
                            Sex: <strong className="text-ink font-bold">{cap(profile.sex)}</strong>
                          </>
                        ) : (
                          <span className="text-muted">Sex: Not specified</span>
                        )}
                      </span>
                    </span>

                    {profile?.timezone && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-soft/80 border border-line font-medium text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="font-mono text-[11px]">{profile.timezone}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Quick Action Controls */}
              <div className="flex items-center md:items-end justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line">
                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-brand hover:bg-brand-hover text-white shadow-sm shadow-brand/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Pencil className="w-3.5 h-3.5 text-white/90" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </section>

          {/* 2. Main Content Grid (Balanced 7 / 5 Layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            {/* Left Column (7 cols): Physical Biometrics & Clinical Records */}
            <div className="lg:col-span-7 space-y-6">
              {/* 4-Stat Metric Tiles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Height Tile */}
                <div className="surface p-5 rounded-2xl border border-line bg-surface shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5">
                  <span className="p-3 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                    <Ruler className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
                      Height
                    </span>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-2xl font-black text-ink font-mono">
                        {profile?.height_cm != null ? profile.height_cm : '—'}
                      </span>
                      <span className="text-xs font-semibold text-muted">cm</span>
                      {feetInches && (
                        <span className="text-xs font-mono text-muted ml-1">({feetInches})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Weight Tile */}
                <div className="surface p-5 rounded-2xl border border-line bg-surface shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5">
                  <span className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                    <WeightScaleIcon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
                      Weight
                    </span>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-2xl font-black text-ink font-mono">
                        {profile?.weight_kg != null ? profile.weight_kg : '—'}
                      </span>
                      <span className="text-xs font-semibold text-muted">kg</span>
                      {lbs && (
                        <span className="text-xs font-mono text-muted ml-1">({lbs})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Activity Level Tile */}
                <div className="surface p-5 rounded-2xl border border-line bg-surface shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5">
                  <span className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
                    <Flame className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
                      Activity Level
                    </span>
                    <span className="text-lg font-bold text-ink block font-display leading-tight">
                      {profile?.activity_level ? cap(profile.activity_level) : 'Moderate'}
                    </span>
                  </div>
                </div>

                {/* Primary Health Goal Tile */}
                <div className="surface p-5 rounded-2xl border border-line bg-surface shadow-xs flex items-center gap-4 transition-all hover:-translate-y-0.5">
                  <span className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                    <Target className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
                      Primary Goal
                    </span>
                    <span className="text-base font-bold text-ink block font-display leading-snug break-words">
                      {profile?.goal || 'Cardiovascular Wellness'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clinical Records & Medical Notes */}
              <section
                className="surface p-6 sm:p-7 rounded-3xl border border-line bg-surface shadow-xs space-y-4"
                aria-labelledby="notes-title"
              >
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-brand/10 text-brand border border-brand/20">
                      <Stethoscope className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 id="notes-title" className="text-sm font-bold text-ink">
                        Clinical History &amp; Medical Notes
                      </h3>
                      <p className="text-[11px] text-muted">Baseline conditions, ongoing therapy, and alerts</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-slate-200/60 border border-line text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-brand" />
                    <span>Update Notes</span>
                  </button>
                </div>

                {profile?.conditions || profile?.medications || profile?.allergies ? (
                  <div className="space-y-3">
                    {profile.conditions && (
                      <div className="p-4 rounded-2xl bg-surface-soft/80 border border-line text-xs text-ink leading-relaxed">
                        <span className="font-bold text-slate-800 block mb-1 uppercase tracking-wider text-[10px]">
                          Diagnosed Conditions
                        </span>
                        <p className="whitespace-pre-wrap">{profile.conditions}</p>
                      </div>
                    )}
                    {profile.medications && (
                      <div className="p-4 rounded-2xl bg-surface-soft/80 border border-line text-xs text-ink leading-relaxed">
                        <span className="font-bold text-slate-800 block mb-1 uppercase tracking-wider text-[10px]">
                          Active Medications
                        </span>
                        <p className="whitespace-pre-wrap">{profile.medications}</p>
                      </div>
                    )}
                    {profile.allergies && (
                      <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-xs text-rose-950 leading-relaxed">
                        <span className="font-bold text-rose-800 block mb-1 uppercase tracking-wider text-[10px]">
                          Known Allergies &amp; Reactions
                        </span>
                        <p className="whitespace-pre-wrap">{profile.allergies}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-4 rounded-2xl bg-surface-soft/60 border border-line/80 flex flex-col justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Conditions</span>
                      <p className="text-xs font-semibold text-slate-700 mt-2">None Recorded</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-surface-soft/60 border border-line/80 flex flex-col justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Medications</span>
                      <p className="text-xs font-semibold text-slate-700 mt-2">No Active Rx</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-surface-soft/60 border border-line/80 flex flex-col justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Allergies</span>
                      <p className="text-xs font-semibold text-emerald-700 mt-2">No Known Allergies</p>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column (5 cols): BMI Gauge & Emergency Readiness */}
            <div className="lg:col-span-5 space-y-6">
              {/* BMI Card */}
              <BmiCard />

              {/* Emergency & Triage Readiness Card */}
              <section
                className="surface p-6 rounded-3xl border border-line bg-surface shadow-xs space-y-4"
                aria-label="Emergency Readiness"
              >
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-ink">Emergency Triage Readiness</h3>
                      <p className="text-[11px] text-muted">Rapid response &amp; dispatch protocol</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Armed
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-soft/70 border border-line text-xs">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-slate-800">1-Touch Automated SOS</span>
                    </div>
                    <span className="font-bold text-emerald-700">Online</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-soft/70 border border-line text-xs">
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-brand" />
                      <span className="font-semibold text-slate-800">Registered Emergency Contacts</span>
                    </div>
                    <span className="font-bold text-ink font-mono">{contacts.length}</span>
                  </div>
                </div>

                <Link
                  to="/emergency"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#0F1E36] hover:bg-[#182633] transition-colors shadow-xs"
                >
                  <span>Open Emergency &amp; Hospital Center</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </section>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Not Onboarded Experience */
        <div className="surface p-10 sm:p-14 rounded-3xl border border-line bg-surface shadow-xs flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-20 h-20 bg-brand/10 text-brand rounded-3xl flex items-center justify-center mb-5 border border-brand/20 shadow-md">
            <User className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-extrabold text-ink mb-2 font-display tracking-tight">
            Set Up Your Clinical Profile
          </h2>
          <p className="text-sm text-muted max-w-md mb-7 leading-relaxed">
            Record your biological sex, height, weight, and fitness targets so Vyana can compute your BMI,
            calibrate heart rate zones, and personalize automated triage.
          </p>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="inline-flex items-center gap-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold px-7 py-3.5 rounded-2xl shadow-md shadow-brand/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span>Complete Profile Setup</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
