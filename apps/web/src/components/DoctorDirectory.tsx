import { useState } from 'react';
import { useHealthStore } from '../store/useHealthStore';
import {shareableVitals} from '../services/shareableVitals';
import { Stethoscope, Phone, Mail, Plus, Trash2, Copy, Check, Building2,PhoneCall } from 'lucide-react';

interface DoctorDirectoryProps {
  onDoctorAdded?: () => void;
}

const COMMON_SPECIALTIES = [
  'Primary Care Physician',
  'Cardiologist',
  'Pulmonologist',
  'Endocrinologist',
  'Neurologist',
  'Emergency Physician',
  'General Practitioner',
  'Internal Medicine Specialist'
];

export function DoctorDirectory({ onDoctorAdded }: DoctorDirectoryProps) {
  const { contacts, addContact, deleteContact, vitals,device,freshness } = useHealthStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState(COMMON_SPECIALTIES[0]);
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [clinic, setClinic] = useState('');
  const [phone, setPhone] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [email, setEmail] = useState('');

  // Filter contacts designated as doctor or clinical role
  const doctorContacts = contacts.filter(
    c => c.is_doctor || /doctor|dr\.?|physician|clinician|cardiologist|surgeon|gp/i.test(c.relation || '')
  );

  const handleCopy = (phoneNumber: string) => {
    navigator.clipboard.writeText(phoneNumber).then(() => {
      setCopiedPhone(phoneNumber);
      setTimeout(() => setCopiedPhone(null), 2000);
    }).catch(() => {
      // Fallback
    });
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Doctor name is required.');
      return;
    }
    if (!phone.trim() && !officePhone.trim() && !email.trim()) {
      setFormError('At least one clinician phone, clinic phone or email is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    const resolvedSpecialty = specialty === 'Other' && customSpecialty.trim() ? customSpecialty.trim() : specialty;
    const relationString = clinic.trim() 
      ? `${resolvedSpecialty} · ${clinic.trim()}` 
      : resolvedSpecialty;



    const ok = await addContact({
      name: name.startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`,
      phone: phone.trim()||null,
      office_phone:officePhone.trim()||null,
      email: email.trim() || null,
      relation: relationString,
      is_doctor: true
    });

    setSubmitting(false);
    if (ok) {
      setName('');
      setClinic('');
      setPhone('');
      setOfficePhone('');
      setEmail('');
      setCustomSpecialty('');
      setShowAddForm(false);
      onDoctorAdded?.();
    } else {
      setFormError(useHealthStore.getState().error || 'Failed to save doctor contact.');
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await deleteContact(id);
    setDeletingId(null);
  };

  const vitalsSnippet=shareableVitals(vitals,device,freshness);
  const mailSubject = encodeURIComponent('Patient Health Inquiry / Telehealth Follow-up');
  const mailBody = encodeURIComponent(`Dear Doctor,\n\nI am contacting you regarding my current health status.\n\nLatest Recorded Vitals:\n${vitalsSnippet}\n\nPlease let me know when you are available for consultation.\n\nBest regards.`);

  return (
    <section className="surface p-3.5 sm:p-4 space-y-3 rounded-xl border border-line bg-surface shadow-2xs" aria-labelledby="doctor-directory-title">
      <div className="flex items-start justify-between flex-wrap gap-2 pb-2.5 border-b border-line">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-surface-soft text-brand border border-line">
              <Stethoscope className="w-4 h-4" aria-hidden="true" />
            </span>
            <h2 id="doctor-directory-title" className="text-base font-bold text-ink">Care Team Contacts</h2>
          </div>
          <p className="text-xs text-muted">
            Save phone numbers supplied by your own clinicians. Availability and emergency coverage are not verified.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="ui-button text-xs gap-1.5 py-1.5 px-3"
          aria-expanded={showAddForm}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddForm ? 'Close Form' : 'Add Doctor'}</span>
        </button>
      </div>

      {/* Add Doctor Inline Form */}
      {showAddForm && (
        <form onSubmit={handleAddDoctor} className="p-3 sm:p-3.5 rounded-xl border border-brand/30 bg-surface-soft/60 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-brand" />
              Add Physician or Specialist
            </h3>
            <span className="text-xs text-muted">Will be flagged as a clinical care team contact</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="doc-name" className="field-label text-xs">Doctor Name *</label>
              <input
                id="doc-name"
                type="text"
                className="ui-input text-sm"
                placeholder="e.g. Dr. Robert Chen, MD"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="doc-specialty" className="field-label text-xs">Specialty *</label>
              <select
                id="doc-specialty"
                className="ui-input text-sm"
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
              >
                {COMMON_SPECIALTIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="Other">Other specialty...</option>
              </select>
            </div>

            {specialty === 'Other' && (
              <div className="sm:col-span-2">
                <label htmlFor="custom-specialty" className="field-label text-xs">Specify Specialty</label>
                <input
                  id="custom-specialty"
                  type="text"
                  className="ui-input text-sm"
                  placeholder="e.g. Allergist, Nephrologist"
                  value={customSpecialty}
                  onChange={e => setCustomSpecialty(e.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="doc-clinic" className="field-label text-xs">Clinic or Hospital Affiliation</label>
              <input
                id="doc-clinic"
                type="text"
                className="ui-input text-sm"
                placeholder="e.g. St. Jude Heart Center"
                value={clinic}
                onChange={e => setClinic(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="doc-phone" className="field-label text-xs">Clinician phone</label>
              <input
                id="doc-phone"
                type="tel"
                className="ui-input text-sm"
                placeholder="Enter the number supplied by your clinician"
                maxLength={32}
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="doc-office" className="field-label text-xs">Office / Clinic Desk Phone</label>
              <input
                id="doc-office"
                type="tel"
                className="ui-input text-sm"
                placeholder="Enter the clinic's phone number"
                maxLength={32}
                value={officePhone}
                onChange={e => setOfficePhone(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="doc-email" className="field-label text-xs">Clinical Email</label>
              <input
                id="doc-email"
                type="email"
                className="ui-input text-sm"
                placeholder="e.g. dr.chen@hospital.org"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-xs text-critical font-medium">{formError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="ui-button secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="ui-button text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? 'Saving Doctor…' : 'Save Doctor Contact'}
            </button>
          </div>
        </form>
      )}

      {/* Doctor List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Your Medical Care Team ({doctorContacts.length})
          </h3>
        </div>

        {doctorContacts.length === 0 ? (
          <div className="p-6 text-center border border-line rounded-xl bg-gradient-to-b from-surface-soft/40 to-surface border-dashed flex flex-col items-center justify-center space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-brand/10 text-brand border border-brand/20 flex items-center justify-center shadow-xs">
              <Stethoscope className="w-5 h-5 text-brand" />
            </div>
            <div className="space-y-1 max-w-md">
              <p className="text-sm font-bold text-ink">No personal clinicians registered</p>
              <p className="text-xs text-muted leading-relaxed">
                Add your primary care doctor, cardiologist, or consulting specialist to keep direct one-click consultation and emergency dispatch channels ready.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brand hover:bg-brand-hover text-white shadow-2xs transition-all flex items-center gap-1.5 mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Doctor Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {doctorContacts.map(doc => {
              // Extract primary phone number from text
              const rawPhone = doc.phone || '';
              const primaryPhone = rawPhone.replace(/\s*\[.*\]/, '').trim();
              const deskNotes=doc.office_phone||null;

              return (
                <div key={doc.id} className="p-3 rounded-xl border border-line bg-surface flex flex-col justify-between hover:shadow-2xs transition-all space-y-2.5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-semibold text-ink text-sm truncate">{doc.name}</h4>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand/10 text-brand">
                            <Stethoscope className="w-3 h-3" />
                            Clinician
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5 truncate">{doc.relation || 'Physician'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        aria-label={`Remove ${doc.name}`}
                        className="text-muted hover:text-critical p-1 rounded hover:bg-critical-bg transition-colors"
                        title="Remove doctor from care team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-body">
                      {primaryPhone && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-brand" /> Phone:
                          </span>
                          <div className="flex items-center gap-1.5 font-medium text-ink">
                            <span>{primaryPhone}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(primaryPhone)}
                              title="Copy number"
                              aria-label={`Copy phone for ${doc.name}`}
                              className="text-muted hover:text-ink p-0.5"
                            >
                              {copiedPhone === primaryPhone ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {deskNotes && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-muted" /> Clinic Desk:
                          </span>
                          <span className="font-medium text-ink">{deskNotes}</span>
                        </div>
                      )}

                      {doc.email && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-brand" /> Email:
                          </span>
                          <span className="font-medium text-ink truncate max-w-[180px]">{doc.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Direct Contact Actions */}
                  <div className="pt-3 border-t border-line flex items-center gap-2">
                    {primaryPhone && (
                      <a
                        href={`tel:${primaryPhone.replace(/[^0-9+]/g, '')}`}
                        className="ui-button flex-1 text-xs py-2 gap-1.5"
                        aria-label={`Call ${doc.name}`}
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call Doctor
                      </a>
                    )}
                    {doc.email && (
                      <a
                        href={`mailto:${doc.email}?subject=${mailSubject}&body=${mailBody}`}
                        className="ui-button secondary text-xs py-2 px-3 gap-1.5"
                        aria-label={`Send medical email to ${doc.name}`}
                      >
                        <Mail className="w-3.5 h-3.5" /> Email
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
