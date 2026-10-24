import { useEffect, useState } from 'react';
import { useHealthStore } from '../store/useHealthStore';
import { AlertTriangle, Phone, Mail, MapPin, Plus, Loader2, Stethoscope } from 'lucide-react';

type OsmElement = { tags?: { name?: string }; lat?: number; lon?: number; center?: {lat: number; lon: number} };
type Hospital = { name: string; lat: number; lon: number; dist: number };
type GeoStatus = 'idle' | 'locating' | 'loading' | 'done' | 'denied' | 'error' | 'empty';

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function Emergency() {
  const { contacts, fetchContacts, addContact, triggerSos, vitals } = useHealthStore();
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const [sosState, setSosState] = useState<'idle' | 'confirm' | 'sending' | 'sent' | 'error'>('idle');
  const doSos = async () => {
    setSosState('sending');
    const ok = await triggerSos('Triggered from the Emergency panel');
    setSosState(ok ? 'sent' : 'error');
  };

  const [form, setForm] = useState({ name: '', phone: '', email: '', relation: '' });
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState('');
  const submitContact = async () => {
    if (!form.name || (!form.phone && !form.email)) { setAddErr('Name and a phone or email are required.'); return; }
    setAdding(true); setAddErr('');
    const ok = await addContact({
      name: form.name, phone: form.phone || null, email: form.email || null,
      relation: form.relation || null, is_doctor: /doctor|dr\.?/i.test(form.relation),
    });
    setAdding(false);
    if (ok) setForm({ name: '', phone: '', email: '', relation: '' });
    else setAddErr(useHealthStore.getState().error || 'Could not save contact. Please retry.');
  };

  const [geo, setGeo] = useState<GeoStatus>('idle');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const findHospitals = () => {
    if (!navigator.geolocation) { setGeo('error'); return; }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setGeo('loading');
        try {
          const q = `[out:json][timeout:10];(node["amenity"="hospital"](around:5000,${lat},${lon});way["amenity"="hospital"](around:5000,${lat},${lon}); );out center;`;
          const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q, signal: AbortSignal.timeout(12000) });
          if (!res.ok) throw new Error('Hospital search unavailable');
          const data = await res.json() as {elements?: OsmElement[]};
          const list: Hospital[] = (data.elements || [])
            .map((el) => ({ name: el.tags?.name ?? 'Unnamed hospital', lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon }))
            .filter((h): h is {name: string; lat: number; lon: number} => typeof h.lat === 'number' && typeof h.lon === 'number')
            .map((h) => ({ ...h, dist: haversineKm(lat, lon, h.lat, h.lon) }))
            .sort((a: Hospital, b: Hospital) => a.dist - b.dist)
            .slice(0, 15);
          setHospitals(list);
          setGeo(list.length ? 'done' : 'empty');
        } catch { setGeo('error'); }
      },
      () => setGeo('denied'),
      { timeout: 10000 }
    );
  };

  const vitalsSnippet = vitals ? `HR ${vitals.heart_rate ?? 'â€”'} bpm, SpO2 ${vitals.spo2 ?? 'â€”'}%, Temp ${vitals.temperature ?? 'â€”'}C` : '';
  const mailBody = encodeURIComponent(`This is an emergency alert from Vyana.\n\nLatest vitals: ${vitalsSnippet}`);
  const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-7 h-7 text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">Emergency</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[13px] rounded-xl px-4 py-3">
        This does not contact emergency services automatically. In a real emergency, call your local emergency number.
      </div>

      {sosState === 'error' && <p role="alert" className="text-critical">The emergency alert could not be logged. Try again, or contact your doctor directly.</p>}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
        {sosState === 'sent' ? (
          <div className="py-4" role="status">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <p className="font-semibold text-gray-900">Emergency alert logged</p>
            <p className="text-[13px] text-gray-500 mt-1">Itâ€™s now active on your dashboard. Contact your doctor below.</p>
            <button type="button" onClick={() => setSosState('idle')} className="mt-4 text-[13px] font-medium text-brand hover:text-brand-hover">Done</button>
          </div>
        ) : sosState === 'confirm' ? (
          <div className="py-4">
            <p className="font-semibold text-gray-900 mb-1">Trigger an emergency alert?</p>
            <p className="text-[13px] text-gray-500 mb-4">This logs a critical alert and surfaces your contacts.</p>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={() => setSosState('idle')} className="px-4 py-2 rounded-xl text-[14px] font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Cancel</button>
              <button type="button" onClick={doSos} className="px-5 py-2 rounded-xl text-[14px] font-semibold text-white bg-red-600 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Confirm</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setSosState('confirm')} disabled={sosState === 'sending'}
            className="w-32 h-32 rounded-full bg-red-600 text-white font-bold text-xl shadow-lg hover:bg-red-700 active:scale-95 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300">
            {sosState === 'sending' ? 'â€¦' : 'SOS'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-800 mb-4">Emergency Contacts</h2>
          {contacts.length === 0 ? (
            <p className="text-[13px] text-gray-500 mb-4">No contacts yet. Add your doctor or a family member below.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 truncate">{c.name}{c.is_doctor && <Stethoscope className="inline w-3.5 h-3.5 text-brand ml-1" />}</p>
                    <p className="text-[12px] text-gray-500 truncate">{c.relation || 'Contact'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.phone && <a href={`tel:${encodeURIComponent(c.phone)}`} aria-label={`Call ${c.name}`} className="p-2 rounded-lg bg-surface-soft text-brand hover:bg-[#d8ede8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Phone className="w-4 h-4" /></a>}
                    {c.email && <a href={`mailto:${c.email}?subject=${encodeURIComponent('Emergency')}&body=${mailBody}`} aria-label={`Email ${c.name}`} className="p-2 rounded-lg bg-surface-soft text-brand hover:bg-[#d8ede8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Mail className="w-4 h-4" /></a>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className={input} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Contact name" />
              <input className={input} placeholder="Relation (e.g. Doctor)" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} aria-label="Relation" />
              <input className={input} type="tel" autoComplete="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label="Phone" />
              <input className={input} type="email" autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Email" />
            </div>
            {addErr && <p role="alert" className="text-[12px] text-red-600">{addErr}</p>}
            <button type="button" onClick={submitContact} disabled={adding}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand-hover disabled:opacity-50 rounded-lg px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <Plus className="w-4 h-4" /> {adding ? 'Addingâ€¦' : 'Add contact'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-800 mb-4">Nearby Hospitals</h2>
          <button type="button" onClick={findHospitals} disabled={geo === 'locating' || geo === 'loading'}
            className="flex items-center gap-2 text-[14px] font-semibold text-white bg-brand hover:bg-brand-hover rounded-xl px-4 py-2.5 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            {(geo === 'locating' || geo === 'loading') ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {geo === 'locating' ? 'Locatingâ€¦' : geo === 'loading' ? 'Searchingâ€¦' : 'Find hospitals near me'}
          </button>

          <div className="mt-4" role="status" aria-live="polite">
            {geo === 'denied' && <p className="text-[13px] text-amber-600">Location permission denied. Enable location to find nearby hospitals.</p>}
            {geo === 'error' && <p className="text-[13px] text-red-600">Couldnâ€™t search right now. Please try again.</p>}
            {geo === 'empty' && <p className="text-[13px] text-gray-500">No hospitals found within 5 km.</p>}
            {geo === 'done' && (
              <ul className="space-y-2">
                {hospitals.map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-gray-900 truncate">{h.name}</p>
                      <p className="text-[12px] text-gray-500">{h.dist.toFixed(1)} km away</p>
                    </div>
                    <a href={`https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lon}#map=17/${h.lat}/${h.lon}`} target="_blank" rel="noreferrer"
                      className="text-[12px] font-semibold text-brand hover:text-brand-hover shrink-0">Map</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
