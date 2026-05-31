const MUMBAI_VIEWBOX = '72.75,18.85,73.0,19.35';
const UA = 'RouteRight/1.0';

export type Place = {
  display_name: string;
  lat: string;
  lon: string;
};

export async function autocomplete(query: string): Promise<Place[]> {
  if (query.trim().length < 2) return [];
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}&format=json&limit=4` +
    `&viewbox=${MUMBAI_VIEWBOX}&bounded=1&countrycodes=in`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    return (await res.json()) as Place[];
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        suburb?: string;
        neighbourhood?: string;
        city_district?: string;
        county?: string;
      };
    };
    const a = data.address;
    if (a) {
      const label = a.suburb ?? a.neighbourhood ?? a.city_district ?? a.county;
      if (label) return label;
    }
    return (data.display_name ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`).split(',')[0].trim();
  } catch {
    return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  }
}

export function shortName(displayName: string): string {
  return displayName.split(',')[0].trim();
}
