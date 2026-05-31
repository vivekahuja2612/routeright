export interface TrainOption {
  line: string;
  departures: string[];
  duration_minutes: number;
  fare_inr: number;
}

export interface BusOption {
  route: string;
  from: string;
  to: string;
  duration_minutes: number;
  fare_inr: number;
  frequency_minutes: number;
}

export interface RouteEntry {
  trains: TrainOption[];
  buses: BusOption[];
  walk_to_station_minutes: number;
  walk_from_station_minutes: number;
  congestion: { most: string; least: string };
}

export const LOCALITIES: Record<string, { lat: number; lng: number }> = {
  'andheri':       { lat: 19.1136, lng: 72.8697 },
  'borivali':      { lat: 19.2307, lng: 72.8567 },
  'churchgate':    { lat: 18.9356, lng: 72.8258 },
  'lower parel':   { lat: 18.9939, lng: 72.8302 },
  'dadar':         { lat: 19.0178, lng: 72.8478 },
  'bandra':        { lat: 19.0596, lng: 72.8295 },
  'kurla':         { lat: 19.0719, lng: 72.8793 },
  'thane':         { lat: 19.2183, lng: 72.9781 },
  'malad':         { lat: 19.1872, lng: 72.8490 },
  'goregaon':      { lat: 19.1663, lng: 72.8526 },
  'kandivali':     { lat: 19.2046, lng: 72.8551 },
  'vile parle':    { lat: 19.1034, lng: 72.8562 },
  'santacruz':     { lat: 19.0832, lng: 72.8437 },
  'khar':          { lat: 19.0740, lng: 72.8376 },
  'mahim':         { lat: 19.0379, lng: 72.8404 },
  'worli':         { lat: 19.0134, lng: 72.8155 },
  'parel':         { lat: 18.9992, lng: 72.8404 },
  'mumbai central': { lat: 18.9687, lng: 72.8193 },
  'cst':           { lat: 18.9398, lng: 72.8354 },
  'csmt':          { lat: 18.9398, lng: 72.8354 },
  'bkc':           { lat: 19.0653, lng: 72.8686 },
  'nariman point': { lat: 18.9256, lng: 72.8242 },
};

// Keyed by "normalized-source→normalized-dest"
const ROUTES: Record<string, RouteEntry> = {
  'andheri→lower parel': {
    trains: [
      {
        line: 'WR Slow (towards Churchgate)',
        departures: ['8:14am', '8:20am', '8:26am', '8:32am'],
        duration_minutes: 27,
        fare_inr: 10,
      },
    ],
    buses: [
      { route: '221', from: 'Andheri West Bus Stop', to: 'Lower Parel', duration_minutes: 50, fare_inr: 22, frequency_minutes: 15 },
      { route: '271', from: 'Andheri Station (East)', to: 'Lower Parel', duration_minutes: 45, fare_inr: 20, frequency_minutes: 20 },
    ],
    walk_to_station_minutes: 4,
    walk_from_station_minutes: 12,
    congestion: { most: '8:00am – 10:00am', least: '10:00am – 12:00pm' },
  },

  'kurla→nariman point': {
    trains: [
      {
        line: 'CR Main Line Fast (Kurla → Chhatrapati Shivaji Maharaj Terminus)',
        departures: ['7:20am', '7:25am', '7:30am', '7:35am', '7:40am', '7:45am', '7:50am'],
        duration_minutes: 22,
        fare_inr: 15,
      },
    ],
    buses: [
      { route: '3 LTD', from: 'Kurla Bus Depot', to: 'Nariman Point', duration_minutes: 80, fare_inr: 25, frequency_minutes: 20 },
    ],
    walk_to_station_minutes: 5,
    walk_from_station_minutes: 15,
    congestion: { most: '7:00am – 10:00am', least: '11:00am – 1:00pm' },
  },

  'borivali→churchgate': {
    trains: [
      {
        line: 'WR Fast (towards Churchgate — stops: Borivali, Andheri, Bandra, Dadar, Mumbai Central, Churchgate)',
        departures: ['9:02am', '9:07am', '9:13am', '9:19am'],
        duration_minutes: 53,
        fare_inr: 15,
      },
    ],
    buses: [
      { route: '231', from: 'Borivali West', to: 'Churchgate area', duration_minutes: 110, fare_inr: 30, frequency_minutes: 30 },
    ],
    walk_to_station_minutes: 5,
    walk_from_station_minutes: 6,
    congestion: { most: '8:00am – 10:00am', least: '10:00am – 12:00pm' },
  },
};

export function normalize(loc: string): string {
  return loc
    .toLowerCase()
    .trim()
    .replace(/\s+(station|west|east|road|naka|junction|jn\.?)$/i, '');
}

export function lookupRoute(source: string, dest: string): RouteEntry | null {
  return ROUTES[`${normalize(source)}→${normalize(dest)}`] ?? null;
}
