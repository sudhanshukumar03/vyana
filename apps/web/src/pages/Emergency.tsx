import { useEffect, useState } from 'react';
import { useHealthStore } from '../store/useHealthStore';
import {
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
  Hospital as HospitalIcon,
  Stethoscope,
  Users,
  PhoneCall,
  Sliders,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { DoctorDirectory } from '../components/DoctorDirectory';
import { NearbyHospitals } from '../components/NearbyHospitals';
import { ManualSosPanel } from '../components/ManualSosPanel';
import { shareableVitals } from '../services/shareableVitals';

type EmergencyTab = 'all' | 'hospitals' | 'doctors' | 'personal';

export default function Emergency() {
  const { contacts, fetchContacts, addContact, deleteContact, vitals, device, freshness } = useHealthStore();
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const [activeTab, setActiveTab] = useState<EmergencyTab>('all');
  const [form, setForm] = useState({ name: '', phone: '', email: '', relation: '', isDoctor: false });
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || (!form.phone && !form.email)) {
      setAddErr('Name and at least one phone number or email are required.');
      return;
    }
    setAdding(true);
    setAddErr('');

    const ok = await addContact({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      relation: form.relation.trim() || 'Family / Emergency Contact',
      is_doctor: form.isDoctor || /doctor|dr\.?|physician|clinician|gp/i.test(form.relation),
    });
    setAdding(false);
    if (ok) {
      setForm({ name: '', phone: '', email: '', relation: '', isDoctor: false });
    } else {
      setAddErr(useHealthStore.getState().error || 'Could not save contact. Please retry.');
    }
  };

  const removeContact = async (id: number) => {
    setDeletingId(id);
    await deleteContact(id);
    setDeletingId(null);
  };

  // Filter personal / non-doctor emergency contacts
  const personalContacts = contacts.filter(
    (c) => !c.is_doctor && !/doctor|dr\.?|physician|clinician|cardiologist/i.test(c.relation || '')
  );
  const doctorContactsCount = contacts.filter(
    (c) => c.is_doctor || /doctor|dr\.?|physician|clinician|cardiologist/i.test(c.relation || '')
  ).length;

  const vitalsSnippet = shareableVitals(vitals, device, freshness);
  const mailBody = encodeURIComponent(`This is an emergency alert from Vyana.\n\nLatest readings: ${vitalsSnippet}`);
  const inputClass =
    'w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand';

  return (
    <div className="page-stack w-full !gap-3.5">
      <PageHeader
        title="Emergency"
        description="Immediate SOS broadcast, automated hospital routing, and direct doctor contact channels."
        icon={AlertTriangle}
        tone="critical"
        action={
          <Link
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-soft border border-line text-ink transition-colors shadow-2xs shrink-0"
            to="/settings#sos-settings"
          >
            <Sliders className="w-3.5 h-3.5 text-muted" />
            <span>SOS Dispatch Settings</span>
          </Link>
        }
      />

      {/* Critical Life-Threatening Alert Header */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5 shadow-2xs">
        <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200 shrink-0 mt-0.5">
          <PhoneCall className="w-4 h-4 text-rose-700" aria-hidden="true" />
        </div>
        <div className="space-y-0.5">
          <h2 className="text-xs sm:text-sm font-bold text-rose-900">Life-Threatening Medical Emergency Notice</h2>
          <p className="text-[11px] sm:text-xs text-rose-900 leading-normal font-normal">
            Vyana records and broadcasts vital telemetry to configured gateways. If experiencing
            chest pain, severe breathlessness, or acute trauma, dial emergency dispatch immediately:{' '}
            <strong className="font-bold underline text-rose-950">911</strong> (US/Canada), <strong className="font-bold underline text-rose-950">112</strong> (EU/UK),
            or <strong className="font-bold underline text-rose-950">108</strong> (India).
          </p>
        </div>
      </div>

      {/* Emergency Tab Switcher */}
      <div
        role="tablist"
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
        aria-label="Emergency sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
            activeTab === 'all'
              ? 'bg-brand text-white border-brand shadow-xs'
              : 'border-line bg-surface hover:bg-surface-soft text-ink shadow-2xs'
          }`}
        >
          All Facilities &amp; Contacts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'hospitals'}
          onClick={() => setActiveTab('hospitals')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
            activeTab === 'hospitals'
              ? 'bg-brand text-white border-brand shadow-xs'
              : 'border-line bg-surface hover:bg-surface-soft text-ink shadow-2xs'
          }`}
        >
          <HospitalIcon className="w-3.5 h-3.5" />
          <span>Nearby Hospitals</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'doctors'}
          onClick={() => setActiveTab('doctors')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
            activeTab === 'doctors'
              ? 'bg-brand text-white border-brand shadow-xs'
              : 'border-line bg-surface hover:bg-surface-soft text-ink shadow-2xs'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>Doctor Interfaces {doctorContactsCount > 0 && `(${doctorContactsCount})`}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'personal'}
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
            activeTab === 'personal'
              ? 'bg-brand text-white border-brand shadow-xs'
              : 'border-line bg-surface hover:bg-surface-soft text-ink shadow-2xs'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Family &amp; Contacts {personalContacts.length > 0 && `(${personalContacts.length})`}</span>
        </button>
      </div>

      {/* Manual SOS Trigger Component */}
      {(activeTab === 'all' || activeTab === 'personal') && <ManualSosPanel />}

      {/* Nearby Hospitals & Emergency Facilities Section */}
      {(activeTab === 'all' || activeTab === 'hospitals') && <NearbyHospitals />}

      {/* Doctor Interfaces & Contact Numbers Section */}
      {(activeTab === 'all' || activeTab === 'doctors') && (
        <DoctorDirectory onDoctorAdded={fetchContacts} />
      )}

      {/* Personal & Family Emergency Contacts Section */}
      {(activeTab === 'all' || activeTab === 'personal') && (
        <section
          className="surface p-3.5 sm:p-4 rounded-xl border border-line bg-surface shadow-2xs space-y-3"
          aria-labelledby="personal-contacts-title"
        >
          <div className="flex items-start justify-between flex-wrap gap-2 pb-2.5 border-b border-line">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-surface-soft text-brand border border-line">
                  <Users className="w-4 h-4" aria-hidden="true" />
                </span>
                <h2 id="personal-contacts-title" className="text-base font-bold text-ink">
                  Family &amp; Personal Contacts
                </h2>
              </div>
              <p className="text-[11px] text-muted">
                Next of kin, family members, or caregivers to notify immediately during an incident.
              </p>
            </div>
          </div>

          {personalContacts.length === 0 ? (
            <div className="p-5 text-center border border-line rounded-xl bg-gradient-to-b from-surface-soft/40 to-surface border-dashed flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand border border-brand/20 flex items-center justify-center shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 max-w-sm">
                <p className="text-xs font-bold text-ink">No personal emergency contacts registered</p>
                <p className="text-[11px] text-muted leading-relaxed">
                  Add a spouse, parent, or trusted caregiver below. Vyana queues instant notifications and vitals snippets when emergency alerts trigger.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {personalContacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2.5 border border-line rounded-lg p-2.5 sm:p-3 bg-surface hover:bg-surface-soft/40 transition-colors shadow-2xs"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{c.name}</p>
                    <p className="text-xs text-muted truncate">{c.relation || 'Emergency Contact'}</p>
                    {c.phone && <p className="text-xs text-brand font-mono font-medium mt-1">{c.phone}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.phone && (
                      <a
                        href={`tel:${encodeURIComponent(c.phone)}`}
                        aria-label={`Call ${c.name}`}
                        title="Voice Call"
                        className="p-2 rounded-lg bg-surface-soft text-brand hover:bg-brand hover:text-white transition-colors border border-line"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}?subject=${encodeURIComponent(
                          'Emergency Alert from Vyana'
                        )}&body=${mailBody}`}
                        aria-label={`Email ${c.name}`}
                        title="Send Email Alert"
                        className="p-2 rounded-lg bg-surface-soft text-brand hover:bg-brand hover:text-white transition-colors border border-line"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                    {c.phone && (
                      <a
                        href={`sms:${encodeURIComponent(c.phone)}?body=${mailBody}`}
                        aria-label={`Message ${c.name}`}
                        title="Send SMS Alert"
                        className="p-2 rounded-lg bg-surface-soft text-brand hover:bg-brand hover:text-white transition-colors border border-line"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => removeContact(c.id)}
                      disabled={deletingId === c.id}
                      aria-label={`Delete ${c.name}`}
                      title="Remove contact"
                      className="p-2 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Add Form */}
          <form
            onSubmit={submitContact}
            className="pt-3.5 border-t border-line space-y-3"
            aria-label="Add personal emergency contact"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-brand" />
              Add Personal Contact
            </h3>
            {addErr && <p role="alert" className="text-xs text-rose-600 font-medium">{addErr}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="contact-name" className="block text-[11px] font-semibold text-muted mb-1">
                  Full Name *
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-phone" className="block text-[11px] font-semibold text-muted mb-1">
                  Phone Number
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact-relation" className="block text-[11px] font-semibold text-muted mb-1">
                  Relationship
                </label>
                <input
                  id="contact-relation"
                  type="text"
                  placeholder="Spouse, Mother, Friend"
                  value={form.relation}
                  onChange={(e) => setForm({ ...form, relation: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex-1 max-w-sm mr-4">
                <label htmlFor="contact-email" className="block text-[11px] font-semibold text-muted mb-1">
                  Email Address (Optional)
                </label>
                <input
                  id="contact-email"
                  type="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-brand hover:bg-brand-hover text-white shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{adding ? 'Saving…' : 'Add Contact'}</span>
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
