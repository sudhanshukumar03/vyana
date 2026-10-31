import { useState } from 'react';
import {
  Hospital as HospitalIcon,
  PhoneCall,
  MapPin,
  Navigation,
  Search,
  Loader2,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  Map as MapIcon,
  Layers,
  ExternalLink,
  Bed,
  Building2,
  Crosshair,
  RefreshCw,
  Globe,
} from 'lucide-react';
import {
  geocodeSearchWithGeoapify,
  reverseGeocodeWithGeoapify,
  fetchHospitalsWithGeoapify,
} from '../services/geoapify';
import {
  fetchNinjasHospitals,
  type HospitalFacility,
} from '../services/ninjasHospitals';

interface QuickCity {
  name: string;
  query: string;
  lat: number;
  lon: number;
  country: string;
}

const GLOBAL_QUICK_CITIES: QuickCity[] = [
  { name: 'New Delhi, IN', query: 'New Delhi, India', lat: 28.6139, lon: 77.209, country: 'India' },
  { name: 'London, UK', query: 'London, United Kingdom', lat: 51.5074, lon: -0.1278, country: 'United Kingdom' },
  { name: 'New York, US', query: 'New York, NY', lat: 40.7128, lon: -74.006, country: 'United States' },
  { name: 'Chicago, US', query: 'Chicago, IL', lat: 41.8781, lon: -87.6298, country: 'United States' },
  { name: 'Tokyo, JP', query: 'Tokyo, Japan', lat: 35.6769, lon: 139.7639, country: 'Japan' },
  { name: 'Toronto, CA', query: 'Toronto, Canada', lat: 43.6532, lon: -79.3832, country: 'Canada' },
  { name: 'Sydney, AU', query: 'Sydney, Australia', lat: -33.8688, lon: 151.2093, country: 'Australia' },
];


export function NearbyHospitals() {
  const [facilities, setFacilities] = useState<HospitalFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [activeLocationName, setActiveLocationName] = useState<string>('Choose a location');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | '24_7' | 'clinic'>('all');
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'cards'>('split');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'loading' | 'done' | 'denied' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<'geoapify' | 'hybrid'>('geoapify');

  const beginLookup = (location: string) => {
    setFacilities([]);
    setSelectedFacilityId('');
    setActiveLocationName(location);
    setActiveEngine('geoapify');
    setGeoStatus('idle');
    setIsLoading(true);
  };

  const handleCopy = (phoneNumber: string) => {
    navigator.clipboard
      .writeText(phoneNumber)
      .then(() => {
        setCopiedPhone(phoneNumber);
        setTimeout(() => setCopiedPhone(null), 2000);
      })
      .catch(() => {});
  };

  // Quick City chip click handler
  const handleSelectCity = async (cityItem: QuickCity) => {
    if (isLoading) return;
    beginLookup(cityItem.name);
    setSearchQuery('');

    try {
      // 1. Fetch live hospitals via Geoapify Places (global coverage)
      const geoResults = await fetchHospitalsWithGeoapify(cityItem.lat, cityItem.lon, 15000);

      // 2. If it's a US city, also attempt API Ninjas augmentation for bed counts
      let finalResults = geoResults;
      if (cityItem.country === 'United States') {
        try {
          const parts = cityItem.query.split(',').map((p) => p.trim());
          const ninjaResults = await fetchNinjasHospitals(
            { city: parts[0], state: parts[1] },
            cityItem.lat,
            cityItem.lon
          );
          if (ninjaResults.length > 0) {
            // Merge or prefer live results
            const geoIds = new Set(geoResults.map((g) => g.name.toLowerCase()));
            const complementary = ninjaResults.filter((n) => !geoIds.has(n.name.toLowerCase()));
            finalResults = [...geoResults, ...complementary].sort((a, b) => a.distanceKm - b.distanceKm);
            setActiveEngine('hybrid');
          }
        } catch {
          // Geoapify results are already available
        }
      }

      if (finalResults.length > 0) {
        setFacilities(finalResults);
        setSelectedFacilityId(finalResults[0]?.id || '');
      } else {
        setFacilities([]);
        setSelectedFacilityId('');
      }
    } catch {
      setFacilities([]);setSelectedFacilityId('');setGeoStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Worldwide GPS location lookup via Geoapify reverse-geocoding
  const handleFindLiveHospitals = () => {
    if (isLoading) return;
    beginLookup('Current location');
    setSearchQuery('');
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setIsLoading(false);
      return;
    }

    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setGeoStatus('loading');
        setIsLoading(true);

        try {
          // Worldwide reverse geocode with Geoapify
          const rev = await reverseGeocodeWithGeoapify(lat, lon);
          if (rev?.formatted) {
            setActiveLocationName(`GPS: ${rev.city || rev.formatted}`);
          }

          // Fetch hospitals around current GPS coordinates worldwide
          const live = await fetchHospitalsWithGeoapify(lat, lon, 15000);

          if (live.length > 0) {
            setFacilities(live);
            setSelectedFacilityId(live[0]?.id || '');
            setActiveEngine('geoapify');
          } else {
            setFacilities([]);
            setSelectedFacilityId('');
          }

          setGeoStatus('done');
        } catch (err) {
          console.error('GPS lookup error:', err);
          setGeoStatus('error');
        } finally {
          setIsLoading(false);
        }
      },
      () => {
        setGeoStatus('denied');
        setIsLoading(false);
      },
      { timeout: 12000 }
    );
  };

  // Live worldwide search powered by Geoapify Geocoding API (/v1/geocode/search)
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query || isLoading) return;

    beginLookup(query);

    try {
      // Step 1: Geocode the search text anywhere in the world using Geoapify
      const geoResult = await geocodeSearchWithGeoapify(query);

      if (geoResult) {
        const { lat, lon, formatted, city, state, countryCode } = geoResult;
        setActiveLocationName(formatted || query);

        // Step 2: Fetch worldwide healthcare places around resolved coordinates
        let hospitalResults = await fetchHospitalsWithGeoapify(lat, lon, 15000);

        // If in USA, also check API Ninjas for complementary bed counts
        if (countryCode === 'US' && (city || state)) {
          try {
            const ninjaHospitals = await fetchNinjasHospitals({ city, state }, lat, lon);
            if (ninjaHospitals.length > 0) {
              const geoNames = new Set(hospitalResults.map((h) => h.name.toLowerCase()));
              const additional = ninjaHospitals.filter((n) => !geoNames.has(n.name.toLowerCase()));
              hospitalResults = [...hospitalResults, ...additional].sort((a, b) => a.distanceKm - b.distanceKm);
              setActiveEngine('hybrid');
            }
          } catch {
            // Geoapify results are already available
          }
        } else {
          setActiveEngine('geoapify');
        }

        setFacilities(hospitalResults);
        setSelectedFacilityId(hospitalResults[0]?.id || '');
        setGeoStatus('done');
      } else {
        setGeoStatus('error');
      }
    } catch (err) {
      console.error('Geoapify search failed:', err);
      setGeoStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // The search box resolves a location; category chips filter its results.
  const filteredFacilities = facilities.filter((f) => {
    if (filterType === '24_7') return f.isOpen24Hours;

    if (filterType === 'clinic') return f.categoryLabel === 'Clinic';
    return true;
  });

  // Currently selected hospital
  const selectedHospital =
    filteredFacilities.find((f) => f.id === selectedFacilityId) ||
    filteredFacilities[0];

  // Map embed URL with dynamic marker and bounding box anywhere on Earth
  const mapLat = selectedHospital ? selectedHospital.lat : 0;
  const mapLon = selectedHospital ? selectedHospital.lon : 0;
  const mapDeltaLat = 0.018;
  const mapDeltaLon = 0.026;
  const bbox = `${mapLon - mapDeltaLon},${mapLat - mapDeltaLat},${mapLon + mapDeltaLon},${mapLat + mapDeltaLat}`;
  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mapLat},${mapLon}`;

  const cleanPhone = selectedHospital?.erPhone.replace(/[^0-9+]/g, '') || '';

  return (
    <section className="surface p-3.5 sm:p-4 space-y-3 rounded-xl border border-line bg-surface shadow-2xs" aria-labelledby="nearby-hospitals-title">
      {/* Header bar with Status Badge & GPS Action */}
      <div className="flex items-start justify-between flex-wrap gap-2 pb-2.5 border-b border-line">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1 rounded-md bg-surface-soft text-brand border border-line">
              <HospitalIcon className="w-4 h-4" aria-hidden="true" />
            </span>
            <h2 id="nearby-hospitals-title" className="text-base font-bold text-ink">
              Nearby Hospitals &amp; Facilities
            </h2>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs"
              title="Location search uses Geoapify"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span>Geoapify Global Engine</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            </span>
          </div>
          <p className="text-xs text-muted">
            Search provider-listed healthcare facilities and contact details on an OpenStreetMap map.
          </p>
        </div>

        {/* View Mode Switcher and GPS Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-surface-soft p-0.5 rounded-lg border border-line text-xs">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'split' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink'
              }`}
              title="Split View (Interactive Map + Facilities List)"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Split</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'map' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink'
              }`}
              title="Full Map Focus"
            >
              <span className="flex items-center gap-1.5">
                <MapIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Map</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'cards' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink'
              }`}
              title="List Only"
            >
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleFindLiveHospitals}
            disabled={geoStatus === 'locating' || geoStatus === 'loading' || isLoading}
            className="ui-button text-xs gap-1.5 font-semibold py-1.5 px-3"
            aria-label="Use current location to find nearest hospitals"
          >
            {geoStatus === 'locating' || geoStatus === 'loading' || isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Crosshair className="w-3.5 h-3.5" />
            )}
            {geoStatus === 'locating'
              ? 'Locating…'
              : geoStatus === 'loading'
                ? 'Resolving GPS…'
                : 'GPS Locate'}
          </button>
        </div>
      </div>

      {/* Geolocation feedback note */}
      {geoStatus === 'error' && <p role="alert" className="text-xs text-critical">Location lookup could not be completed. Check the location or try again.</p>}
      {geoStatus === 'denied' && (
        <div className="p-3 rounded-xl border border-line bg-surface-soft text-xs text-muted flex items-start gap-2">
          <MapPin className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <p>
            Location permission was denied. You can search any city, country, or postal code worldwide (e.g. New Delhi, London, Tokyo, Boston) to explore real-time facilities using Geoapify.
          </p>
        </div>
      )}

      {/* Quick Global City Discovery Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted flex-wrap gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <Globe className="w-3.5 h-3.5 text-brand" />
            Worldwide City Explorer (Geoapify Live Discovery):
          </span>
          {activeLocationName && (
            <span className="text-[11px] font-semibold text-brand">
              Active Location: {activeLocationName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {GLOBAL_QUICK_CITIES.map((c) => {
            const isSelected = activeLocationName.includes(c.name) || activeLocationName.includes(c.query);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => handleSelectCity(c)}
                disabled={isLoading}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-brand text-white border-brand shadow-xs'
                    : 'bg-surface border-line text-muted hover:text-ink hover:bg-surface-soft'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Input powered by Geoapify Geocode Search */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              className="ui-input text-sm pr-3"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search any city or address worldwide (e.g. New Delhi, London, Tokyo, Boston, Sydney, Paris)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search hospitals worldwide"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchQuery.trim()}
            className="ui-button text-xs py-2 px-3.5 gap-1.5 font-semibold shrink-0"
            title="Search location using Geoapify Geocoding API"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Geoapify Search
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted font-medium mr-1">Care Filter:</span>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-brand text-white border-brand'
                : 'border-line bg-surface hover:bg-surface-soft text-body'
            }`}
          >
            All Facilities ({facilities.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('24_7')}
            className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
              filterType === '24_7'
                ? 'bg-brand text-white border-brand'
                : 'border-line bg-surface hover:bg-surface-soft text-body'
            }`}
          >
            Listed 24-hour facilities
          </button>

          <button
            type="button"
            onClick={() => setFilterType('clinic')}
            className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
              filterType === 'clinic'
                ? 'bg-brand text-white border-brand'
                : 'border-line bg-surface hover:bg-surface-soft text-body'
            }`}
          >
            Clinics
          </button>
        </div>
      </div>

      {/* Main Content Area: Split View, Map Only, or Cards Only */}
      <div
        className={`grid gap-4 ${
          viewMode === 'split'
            ? 'grid-cols-1 lg:grid-cols-12'
            : viewMode === 'map'
              ? 'grid-cols-1'
              : 'grid-cols-1'
        }`}
      >
        {/* INTERACTIVE VISUAL MAP FRAME */}
        {viewMode !== 'cards' && (
          <div
            className={`relative rounded-2xl overflow-hidden border border-line shadow-xs bg-slate-900 ${
              viewMode === 'split' ? 'lg:col-span-6 xl:col-span-7 h-[420px] lg:h-[580px]' : 'h-[500px]'
            }`}
          >
            {/* Live Interactive Map Iframe centered globally */}
            <iframe
              title={`Interactive map centered on ${selectedHospital?.name || 'Hospital'}`}
              src={selectedHospital?mapEmbedUrl:undefined}
              className="w-full h-full border-0 filter contrast-[1.05]"
              loading="lazy"
            />

            {/* Floating Map HUD overlay with Selected Hospital details */}
            {selectedHospital && (
              <div className="absolute bottom-3 left-3 right-3 p-3.5 rounded-xl bg-surface/95 backdrop-blur-md border border-line/80 shadow-lg text-ink space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-ink truncate">{selectedHospital.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-brand/10 text-brand">
                        {selectedHospital.categoryLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0 text-brand" />
                      <span className="truncate">{selectedHospital.address}</span>
                      <span className="font-semibold text-ink shrink-0">
                        · {selectedHospital.distanceKm} km away
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    {selectedHospital.bedcount ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                        <Bed className="w-3 h-3" /> {selectedHospital.bedcount} Beds
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted">Listed phone:</span>
                    <a
                      href={cleanPhone?`tel:${cleanPhone}`:undefined}
                      className="font-bold text-brand hover:underline flex items-center gap-1"
                    >
                      <PhoneCall className="w-3 h-3" />
                      {selectedHospital.erPhone || 'Not provided'}
                    </a>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedHospital.lat},${selectedHospital.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-button text-xs py-1 px-2.5 font-semibold gap-1"
                      title="Navigate via Google Maps directions"
                    >
                      <Navigation className="w-3 h-3" /> Navigate
                    </a>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${selectedHospital.lat}&mlon=${selectedHospital.lon}#map=16/${selectedHospital.lat}/${selectedHospital.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-button secondary text-xs py-1 px-2 font-medium"
                      title="Open full interactive map in new tab"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Top HUD badge showing GPS coordinates & Engine source */}
            <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-line text-[11px] font-mono text-muted flex items-center gap-1.5 shadow-xs">
              <MapPin className="w-3 h-3 text-brand" />
              <span>
                {selectedHospital ? `${mapLat.toFixed(4)}°, ${mapLon.toFixed(4)}°` : 'No facility selected'}
              </span>
              <span className="text-[10px] text-brand/80 font-sans ml-1">
                ({activeEngine === 'hybrid' ? 'Geoapify + Ninjas' : 'Geoapify'})
              </span>
            </div>
          </div>
        )}

        {/* HOSPITAL FACILITY CARDS DIRECTORY */}
        {viewMode !== 'map' && (
          <div
            className={`space-y-3 ${
              viewMode === 'split'
                ? 'lg:col-span-6 xl:col-span-5 max-h-[580px] overflow-y-auto pr-1'
                : 'col-span-1'
            }`}
          >
            {isLoading ? (
              <div className="p-8 text-center border border-line rounded-xl bg-surface-soft/40 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" />
                <p className="text-xs font-medium text-ink">Searching worldwide healthcare facilities via Geoapify…</p>
                <p className="text-[11px] text-muted">Retrieving provider-listed facilities and contact details.</p>
              </div>
            ) : filteredFacilities.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-line rounded-xl text-muted text-xs space-y-2">
                <p>No medical facilities found matching your criteria in this area.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                  }}
                  className="ui-button secondary text-xs py-1 px-2.5"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredFacilities.map((hospital) => {
                const isSelected = hospital.id === selectedFacilityId;
                const hospitalCleanPhone = hospital.erPhone.replace(/[^0-9+]/g, '');

                return (
                  <div
                    key={hospital.id}
                    onClick={() => setSelectedFacilityId(hospital.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand ring-2 ring-brand/20 bg-brand/5 shadow-xs'
                        : 'border-line bg-surface hover:bg-surface-soft/60'
                    } space-y-2.5`}
                  >
                    <div className="flex items-start justify-between gap-2.5 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-ink text-sm sm:text-base leading-snug">
                            {hospital.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              hospital.isOpen24Hours
                                  ? 'bg-brand/10 text-brand'
                                  : 'bg-surface-soft text-muted'
                            }`}
                          >
                            {hospital.categoryLabel}
                          </span>
                        </div>

                        <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                          <span>{hospital.address}</span>
                          <span className="font-medium text-ink">· {hospital.distanceKm} km away</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hospital.isOpen24Hours ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success-bg px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Listed 24 hours
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted bg-surface-soft px-2 py-0.5 rounded-full">
                            {hospital.hoursNote || 'Hours not provided'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Features & Bed Count Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {hospital.bedcount ? (
                        <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Bed className="w-3 h-3" /> {hospital.bedcount} Inpatient Beds
                        </span>
                      ) : null}
                      {hospital.ownership && (
                        <span className="text-[10px] text-muted bg-canvas border border-line px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted" /> {hospital.ownership}
                        </span>
                      )}
                      {hospital.features.slice(0, 2).map((feat, fIdx) => (
                        <span
                          key={fIdx}
                          className="text-[10px] text-muted bg-canvas border border-line px-2 py-0.5 rounded-md"
                        >
                          {feat}
                        </span>
                      ))}
                    </div>

                    {/* Action Controls & Emergency Desk */}
                    <div className="pt-2.5 border-t border-line flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="text-xs">
                          <span className="text-muted block text-[10px] uppercase font-semibold">
                            Listed facility phone
                          </span>
                          <div className="flex items-center gap-1.5 font-semibold text-ink">
                            <span>{hospital.erPhone || 'Not provided'}</span>
                            {hospital.erPhone.length > 5 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(hospital.erPhone);
                                }}
                                title="Copy listed phone number"
                                aria-label={`Copy listed phone for ${hospital.name}`}
                                className="text-muted hover:text-ink p-0.5"
                              >
                                {copiedPhone === hospital.erPhone ? (
                                  <Check className="w-3 h-3 text-success" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFacilityId(hospital.id);
                            if (viewMode === 'cards') setViewMode('split');
                          }}
                          className={`ui-button secondary text-xs py-1.5 px-2.5 gap-1 font-medium ${
                            isSelected ? 'border-brand text-brand' : ''
                          }`}
                        >
                          <MapPin className="w-3 h-3" /> {isSelected ? 'Focused on Map' : 'View on Map'}
                        </button>

                        <a
                          href={hospitalCleanPhone?`tel:${hospitalCleanPhone}`:undefined}
                          onClick={(e) => e.stopPropagation()}
                          className="ui-button text-xs py-1.5 px-3 gap-1 font-semibold"
                          aria-label={`Call ${hospital.name}`}
                          aria-disabled={!hospitalCleanPhone}
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> Call facility
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Safety Notice Footer */}
      <div className="p-3.5 rounded-xl border border-line bg-surface-soft/40 flex items-start gap-2.5 text-xs text-muted">
        <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
        <p>
          Provider-listed phone numbers may reach a general switchboard. Opening hours, emergency capability and availability must be confirmed with the facility. Results are supplied by <strong>Geoapify Global Geocoding & Places APIs</strong>. For immediate life-saving assistance requiring dispatch transport, contact your local country emergency services (e.g. <strong>911</strong> in the US/Canada, <strong>112</strong> in India & Europe, <strong>999</strong> in the UK).
        </p>
      </div>
    </section>
  );
}
