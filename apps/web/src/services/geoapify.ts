import {apiFetch} from './api';
/**
 * Geoapify Geocoding, Places, and Reverse-Geocoding Service
 * Powered by Geoapify (https://www.geoapify.com/)
 * Provides worldwide location search, reverse geocoding, and healthcare facility lookup.
 */

import { haversineKm, type HospitalFacility } from './ninjasHospitals';


export interface GeoapifyGeocodeResult {
  lat: number;
  lon: number;
  formatted: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
}

interface GeoapifyRawFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    name?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
    categories?: string[];
    opening_hours?: string;
    website?: string;
    operator?: string;
    contact?: {
      phone?: string;
      email?: string;
    };
    distance?: number;
    place_id?: string;
    datasource?: {
      raw?: {
        name?: string;
        phone?: string;
        'contact:phone'?: string;
        emergency?: string;
        beds?: string | number;
        operator?: string;
        opening_hours?: string;
        healthcare?: string;
        'healthcare:speciality'?: string;
        description?: string;
      };
    };
  };
}

interface GeoapifyResponse {
  type: string;
  features?: GeoapifyRawFeature[];
}

function cleanStr(str?: unknown): string {
  if (str == null) return '';
  if (typeof str !== 'string' && typeof str !== 'number') return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Worldwide Geocode Search via Geoapify API
 * Resolves any city, address, landmark, or postal code in the world to coordinates.
 */
export async function geocodeSearchWithGeoapify(
  query: string,
  signal?: AbortSignal
): Promise<GeoapifyGeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = `/locations/geoapify/geocode/search?text=${encodeURIComponent(
      trimmed
    )}`;
    const res = await apiFetch(url, {
      signal: signal ?? AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      throw new Error('Location search is unavailable. Please retry.');
    }

    const data = (await res.json()) as GeoapifyResponse;
    const first = data.features?.[0];
    if (!first || !first.geometry?.coordinates) return null;

    const [lon, lat] = first.geometry.coordinates;
    const props = first.properties || {};

    return {
      lat,
      lon,
      formatted: cleanStr(props.formatted || props.name || trimmed),
      city: cleanStr(props.city),
      state: cleanStr(props.state),
      country: cleanStr(props.country),
      countryCode: props.country_code?.toUpperCase(),
      postcode: props.postcode,
    };
  } catch (err) {
    throw err instanceof Error ? err : new Error('Location search is unavailable. Please retry.');
  }
}

/**
 * Reverse Geocode via Geoapify API
 * Converts GPS coordinates (lat, lon) anywhere in the world to city, state, country.
 */
export async function reverseGeocodeWithGeoapify(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<GeoapifyGeocodeResult | null> {
  try {
    const url = `/locations/geoapify/geocode/reverse?lat=${lat}&lon=${lon}`;
    const res = await apiFetch(url, {
      signal: signal ?? AbortSignal.timeout(9000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as GeoapifyResponse;
    const first = data.features?.[0];
    if (!first) return null;

    const props = first.properties || {};
    return {
      lat,
      lon,
      formatted: cleanStr(props.formatted || props.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`),
      city: cleanStr(props.city),
      state: cleanStr(props.state),
      country: cleanStr(props.country),
      countryCode: props.country_code?.toUpperCase(),
      postcode: props.postcode,
    };
  } catch {
    return null;
  }
}

/**
 * Worldwide Healthcare & Hospital Places Lookup via Geoapify Places API
 * Finds provider-listed hospitals and clinics around a coordinate.
 */
export async function fetchHospitalsWithGeoapify(
  lat: number,
  lon: number,
  radiusMeters = 15000,
  signal?: AbortSignal
): Promise<HospitalFacility[]> {
  try {
    const url = `/locations/geoapify/places?lat=${lat}&lon=${lon}&radius=${radiusMeters}`;

    const res = await apiFetch(url, {
      signal: signal ?? AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Geoapify Places API responded with status ${res.status}`);
    }

    const data = (await res.json()) as GeoapifyResponse;
    if (!Array.isArray(data.features)) return [];

    return data.features
      .map((f, idx): HospitalFacility | null => {
        const coords = f.geometry?.coordinates;
        if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;

        const hLon = coords[0];
        const hLat = coords[1];
        const props = f.properties || {};
        const raw = props.datasource?.raw || {};

        const name = cleanStr(props.name || raw.name || props.address_line1 || 'Healthcare facility');
        const phone =
          cleanStr(props.contact?.phone || raw.phone || raw['contact:phone']) ||
          '';

        const isEmergency=raw.emergency==='yes';
        const isUrgent=/clinic/i.test(String(raw.healthcare||''))||(props.categories??[]).some(category=>category==='healthcare.clinic_or_praxis'||category.startsWith('healthcare.clinic_or_praxis.'));

        // Parse bed count if present
        let bedcount: number | null = null;
        if (raw.beds) {
          const parsed = parseInt(String(raw.beds), 10);
          if (!isNaN(parsed) && parsed > 0) bedcount = parsed;
        } else if (raw.description && />(\d+)\s+bedded/i.test(raw.description)) {
          const match = raw.description.match(/>(\d+)\s+bedded/i);
          if (match?.[1]) bedcount = parseInt(match[1], 10);
        }

        const distanceKm =
          typeof props.distance === 'number'
            ? Number((props.distance / 1000).toFixed(1))
            : Number(haversineKm(lat, lon, hLat, hLon).toFixed(1));

        const features: string[] = [];
        if (props.operator || raw.operator) {
          features.push(cleanStr(props.operator || raw.operator));
        }
        if (raw['healthcare:speciality']) {
          features.push(
            raw['healthcare:speciality']
              .split(';')
              .map((s) => s.trim())
              .slice(0, 2)
              .join(', ')
          );
        }
        if(isEmergency)features.push('Emergency service listed by provider');

        const address =
          cleanStr(props.formatted || props.address_line2) ||
          `${cleanStr(props.city || 'Regional')}, ${cleanStr(props.country || '')}`;

        return {
          id: `geo-${props.place_id || `${idx}-${hLat}-${hLon}`}`,
          name,
          type: isEmergency ? 'emergency' : 'facility',
          categoryLabel: isUrgent
              ? 'Clinic'
              : 'Healthcare facility',
          address,
          city: cleanStr(props.city) || undefined,
          state: cleanStr(props.state) || undefined,
          country: cleanStr(props.country) || undefined,
          zipcode: props.postcode || undefined,
          erPhone: phone,
          distanceKm,
          isOpen24Hours: (props.opening_hours||raw.opening_hours)==='24/7',
          hoursNote: props.opening_hours || raw.opening_hours || undefined,
          lat: hLat,
          lon: hLon,
          features,
          website: props.website,
          ownership: cleanStr(props.operator || raw.operator) || undefined,
          bedcount,
          source: 'geoapify',
        };
      })
      .filter((h): h is HospitalFacility => h !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (err) {
    throw err instanceof Error ? err : new Error('Facility search is unavailable. Please retry.');
  }
}
