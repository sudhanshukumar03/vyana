import { User, Pencil } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { BmiCard } from '../components/BmiCard';
import { PageHeader } from '../components/PageHeader';

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
    <div className="page-stack page-narrow">
      <PageHeader title="Your Profile" description="Your details, goals and the context behind your wellness guidance." icon={User} action={onboarded && (
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="ui-button secondary"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
        )} />

      <div className="two-column items-start">
      {onboarded ? (
        <dl className="surface profile-details">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="surface flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-surface-soft rounded-full flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-ink mb-1">Profile not set up yet</h2>
          <p className="text-muted max-w-sm mb-5">Set up your health profile so Vyana can personalise insights and BMI.</p>
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
    </div>
  );
}
