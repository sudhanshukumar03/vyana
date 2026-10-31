import {apiFetch} from './api';
/**
 * API Ninjas Hospital and Geocoding Service
 * Powered by API Ninjas (https://api-ninjas.com/api/hospitals)
 */

export interface NinjaHospitalRaw {
  name: string;
  care_type?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  county?: string | null;
  location_area_code?: string | null;
  fips_code?: string | null;
  timezone?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  phone_number?: string | null;
  website?: string | null;
  ownership?: string | null;
  bedcount?: number | null;
}

export interface HospitalFacility {
  id: string;
  name: string;
  type: 'emergency' | 'facility';
  categoryLabel: string;
  address: string;
  city?: string;
  state?: string;
  zipcode?: string;
  erPhone: string;
  distanceKm: number;
  isOpen24Hours: boolean;
  hoursNote?: string;
  lat: number;
  lon: number;
  features: string[];
  country?: string;
  website?: string | null;
  ownership?: string | null;
  bedcount?: number | null;
  source: 'api_ninjas' | 'geoapify';
}


export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function cleanString(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}


/**
 * Searches hospitals from API Ninjas using city, state, zipcode, or name
 */
export async function fetchNinjasHospitals(
  params: {
    city?: string;
    state?: string;
    zipcode?: string;
    name?: string;
  },
  originLat?: number,
  originLon?: number,
  signal?: AbortSignal
): Promise<HospitalFacility[]> {
  const searchParams = new URLSearchParams();
  if (params.city?.trim()) searchParams.set('city', params.city.trim());
  if (params.state?.trim()) searchParams.set('state', params.state.trim());
  if (params.zipcode?.trim()) searchParams.set('zipcode', params.zipcode.trim());
  if (params.name?.trim()) searchParams.set('name', params.name.trim());

  if (!searchParams.toString()) return [];

  const url = `/locations/ninjas/hospitals?${searchParams.toString()}`;
  const res = await apiFetch(url, {
    signal: signal ?? AbortSignal.timeout(9000),
  });

  if (!res.ok) throw new Error(`API Ninjas responded with status ${res.status}`);

  const raw = (await res.json()) as NinjaHospitalRaw[];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, idx): HospitalFacility | null => {
      const lat = typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude;
      const lon = typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude;

      // Ensure valid coordinates
      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        return null;
      }

      const distance =
        originLat != null && originLon != null
          ? Number(haversineKm(originLat, originLon, lat, lon).toFixed(1))
          : 0;

      const rawName = cleanString(item.name);
      const rawAddress = cleanString(item.address);
      const rawCity = cleanString(item.city);
      const rawState = cleanString(item.state);
      const rawCareType = cleanString(item.care_type) || 'Healthcare facility';
      const rawOwnership = cleanString(item.ownership);


      const features: string[] = [];
      if (rawCareType && !rawCareType.toLowerCase().includes('acute care')) features.push(rawCareType);
      

      const street = [rawAddress, rawCity, rawState, item.zipcode].filter(Boolean).join(', ');

      return {
        id: `ninja-${idx}-${lat}-${lon}`,
        name: rawName,
        type: 'facility',
        categoryLabel: rawCareType,
        address: street || 'Address not supplied',
        city: rawCity || undefined,
        state: rawState || undefined,
        zipcode: item.zipcode || undefined,
        erPhone: item.phone_number || '',
        distanceKm: distance,
        isOpen24Hours: false,
        hoursNote:'Opening hours not supplied by provider',
        lat,
        lon,
        features,
        website: item.website,
        ownership: rawOwnership || undefined,
        bedcount: item.bedcount,
        source: 'api_ninjas',
      };
    })
    .filter((f): f is HospitalFacility => f !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
