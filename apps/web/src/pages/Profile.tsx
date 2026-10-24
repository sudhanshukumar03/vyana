import { User, Pencil } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { BmiCard } from '../components/BmiCard';

function ageFromDob(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '—';
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 150 ? String(age) : '—';
}

export default function Profile() {
  const { profile, setShowOnboarding } = useHealthStore();
  const onboarded = !!profile?.onboarded;

  const cap = (s?: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '—');
  const rows: [string, string][] = [
    ['Name', profile?.full_name || '—'],
    ['Age', ageFromDob(profile?.dob)],
    ['Sex', cap(profile?.sex)],
    ['Height', profile?.height_cm != null ? `${profile.height_cm} cm` : '—'],
    ['Weight', profile?.weight_kg != null ? `${profile.weight_kg} kg` : '—'],
    ['Activity level', cap(profile?.activity_level)],
    ['Goal', profile?.goal || '—'],
    ['Notes', profile?.conditions || '—'],
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <User className="w-8 h-8 text-brand" />
          <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
        </div>
        {onboarded && (
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-2 text-[14px] font-medium text-brand hover:text-brand-hover rounded-lg px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
        )}
      </div>

      {onboarded ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between px-5 py-3.5">
              <span className="text-[13px] font-medium text-gray-500">{k}</span>
              <span className="text-[14px] font-semibold text-gray-900 text-right max-w-[60%]">{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Profile not set up yet</h2>
          <p className="text-gray-500 max-w-sm mb-5">Set up your health profile so Vyana can personalise insights and BMI.</p>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="bg-brand text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Set up profile
          </button>
        </div>
      )}

      <BmiCard />
    </div>
  );
}
