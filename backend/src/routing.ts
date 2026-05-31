import { LOCALITIES, normalize } from './corpus';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns road distance estimate (haversine × 1.4 road factor), or null if either locality unknown.
export function roadDistanceKm(source: string, dest: string): number | null {
  const s = LOCALITIES[normalize(source)];
  const d = LOCALITIES[normalize(dest)];
  if (!s || !d) return null;
  return haversineKm(s.lat, s.lng, d.lat, d.lng) * 1.4;
}

// Walking at 80 m/min (~4.8 km/h).
export function walkingBaselineMinutes(distanceKm: number): number {
  return Math.round((distanceKm * 1000) / 80);
}

function isPeakHour(hour: number): boolean {
  return (hour >= 8 && hour < 10) || (hour >= 17 && hour < 21);
}

export interface CabEstimate {
  auto_duration_minutes: number;
  auto_fare_inr: number;
  mini_duration_minutes: number;
  mini_fare_inr: number;
  is_estimated: true;
  disclosure: string;
}

// Mumbai 2024 auto rates: ₹20 base + ₹15/km. Mini cab: ₹50 base + ₹12/km.
// Peak surge: 1.4×. Speed: 23 km/h peak (recalibrated for surface + WEH congestion), 30 km/h off-peak.
// Mini cab 12% faster than auto (AC cars, fewer stops) — ratio not flat to avoid 1-min absurdities.
export function cabEstimate(distanceKm: number, hour: number): CabEstimate {
  const peak = isPeakHour(hour);
  const surge = peak ? 1.4 : 1.0;
  const speedKmh = peak ? 23 : 30;
  const duration = Math.round((distanceKm / speedKmh) * 60);
  const autoFare = Math.round((20 + Math.max(0, distanceKm - 1.5) * 15) * surge);
  const miniFare = Math.round((50 + distanceKm * 12) * surge);
  return {
    auto_duration_minutes: duration,
    auto_fare_inr: Math.max(25, autoFare),
    mini_duration_minutes: Math.max(1, Math.round(duration * 0.88)),
    mini_fare_inr: Math.max(50, miniFare),
    is_estimated: true,
    disclosure: '⚠️ Estimated pricing — live Ola/Uber rates unavailable',
  };
}

// Parses "8:15am" → minutes-since-midnight. Returns null if unparseable.
export function parseMinutes(timeStr: string): number | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

// Formats minutes-since-midnight → "8:15am".
export function formatTime(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const min = totalMinutes % 60;
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(min).padStart(2, '0')}${ampm}`;
}

// Parses "8:15am" → decimal hour for isPeakHour check.
export function parseHour(timeStr: string): number | null {
  const mins = parseMinutes(timeStr);
  return mins !== null ? mins / 60 : null;
}
