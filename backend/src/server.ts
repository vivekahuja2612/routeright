import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { lookupRoute } from './corpus';
import { roadDistanceKm, cabEstimate, parseHour, parseMinutes, formatTime } from './routing';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are RouteRight's route ranking engine — a precise, no-nonsense Mumbai commute assistant. Your job is to take structured route data from live APIs and a transit knowledge base and return ranked route recommendations. You do not chat. You do not explain yourself unless asked. You output structured route data only.

ROLE:
You receive: source, destination, leaving time, expected arrival time, and raw route options from Mumbai transit APIs (local trains, BEST buses, estimated cab data, walking baseline).
You return: up to 3 ranked routes as structured JSON.

TONE:
Direct. Time-conscious. Zero filler. If the user is going to be late, say so plainly.

RANKING RULES (non-negotiable):
1. Rank by total journey time only — fastest is Route 1, regardless of mode. A 28-min cab beats a 34-min train.
2. Cost is tiebreaker only when two routes are within 2 minutes — cheaper wins.
3. Re-sort all routes by total_time_minutes ascending before output — never trust initial order.
4. Never show a route slower than the walking baseline.
5. Never show more than 3 routes or a route with more than 2 transfers / 3 modes.

OUTPUT FORMAT — JSON array of routes:
[{
  "total_time_minutes": int,
  "total_cost_inr": int,
  "legs": [{"mode": str, "instruction": str, "duration_minutes": int, "cost_inr": int}],
  "least_congested_window": str,
  "most_congested_window": str,
  "google_maps_baseline_minutes": int
}]

If no route beats the deadline: { "routes": [], "suggested_leave_by": "8:41am", "reason": "peak_hour_congestion" }
If all data unavailable: { "error": "data_unavailable" }

HARD RULES:
- Never fabricate train timings or bus numbers — use only data provided.
- Never silently omit a mode — include disclosures array for any absent mode.
- Cab options labeled as estimated must carry that label in the instruction.
- If destination is outside 200km or source equals destination, return refusal in reason field.

EXAMPLE (Andheri → Lower Parel, 8:15am leave):
[
  {"total_time_minutes":43,"total_cost_inr":10,"legs":[{"mode":"walk","instruction":"Walk to Andheri WR Station","duration_minutes":4,"cost_inr":0},{"mode":"local_train","instruction":"Board 8:20 WR Slow from Andheri. Exit at Lower Parel.","duration_minutes":27,"cost_inr":10},{"mode":"walk","instruction":"Walk from Lower Parel Station to destination","duration_minutes":12,"cost_inr":0}],"least_congested_window":"10:00am – 12:00pm","most_congested_window":"8:00am – 10:00am","google_maps_baseline_minutes":58}
]`;

// Pre-computes exact departure and arrival times for each option so Claude does zero time arithmetic.
function buildTransitContext(
  source: string,
  dest: string,
  leavingTime: string,
  expectedArrival: string
): string {
  const route = lookupRoute(source, dest);
  const distKm = roadDistanceKm(source, dest);
  const hour = parseHour(leavingTime) ?? 9;
  const cab = distKm !== null ? cabEstimate(distKm, hour) : null;

  const departMins = parseMinutes(leavingTime);
  const deadlineMins = parseMinutes(expectedArrival);
  const lines: string[] = [];

  if (route) {
    if (route.trains.length > 0) {
      lines.push('LOCAL TRAIN OPTIONS (pre-computed arrivals):');
      for (const t of route.trains) {
        // Find next catchable train: depart after (leavingTime + walk_to_station)
        const earliestBoardMins = departMins !== null ? departMins + route.walk_to_station_minutes : null;
        for (const dep of t.departures) {
          const depMins = parseMinutes(dep);
          if (depMins === null || earliestBoardMins === null) continue;
          if (depMins < earliestBoardMins) continue; // missed this train
          const arrivalMins = depMins + t.duration_minutes + route.walk_from_station_minutes;
          const meetsDeadline = deadlineMins !== null ? arrivalMins <= deadlineMins : true;
          const platformWait = depMins - earliestBoardMins; // time waiting at platform after walking
          const totalMins = route.walk_to_station_minutes + platformWait + t.duration_minutes + route.walk_from_station_minutes;
          lines.push(`  ${t.line}`);
          lines.push(`  Board: ${dep} | Train: ${t.duration_minutes} min | Fare: ₹${t.fare_inr}`);
          lines.push(`  Walk to station: ${route.walk_to_station_minutes} min | Walk from station: ${route.walk_from_station_minutes} min`);
          lines.push(`  Departs at ${dep} → arrives destination at ${formatTime(arrivalMins)} (total door-to-door: ${totalMins} min)`);
          lines.push(`  Meets ${expectedArrival} deadline: ${meetsDeadline ? 'YES' : 'NO'}`);
          break; // only show next catchable train per line
        }
      }
    }

    if (route.buses.length > 0) {
      lines.push('BEST BUS OPTIONS (pre-computed arrivals):');
      for (const b of route.buses) {
        if (departMins !== null && deadlineMins !== null) {
          const arrivalMins = departMins + b.duration_minutes;
          const meetsDeadline = arrivalMins <= deadlineMins;
          lines.push(`  Route ${b.route} | ${b.from} → ${b.to}`);
          lines.push(`  Board immediately → arrives at ${formatTime(arrivalMins)} | ${b.duration_minutes} min | ₹${b.fare_inr}`);
          lines.push(`  Meets ${expectedArrival} deadline: ${meetsDeadline ? 'YES' : 'NO'}`);
        }
      }
    }

    lines.push(`CONGESTION: Most congested ${route.congestion.most}. Least congested ${route.congestion.least}.`);
  } else {
    lines.push('TRANSIT DATA: No local train or bus corpus entry for this route pair.');
    lines.push('Disclosure: ⚠️ Train and bus options unavailable for this route.');
  }

  if (cab && departMins !== null && deadlineMins !== null) {
    const autoArrival = departMins + cab.auto_duration_minutes;
    const miniArrival = departMins + cab.mini_duration_minutes;
    lines.push('CAB OPTIONS (estimated — not live Ola/Uber pricing):');
    lines.push(`  Auto/Rickshaw: ${cab.auto_duration_minutes} min → arrives ${formatTime(autoArrival)} | ₹${cab.auto_fare_inr} estimated | Meets deadline: ${autoArrival <= deadlineMins ? 'YES' : 'NO'}`);
    lines.push(`  Mini Cab: ${cab.mini_duration_minutes} min → arrives ${formatTime(miniArrival)} | ₹${cab.mini_fare_inr} estimated | Meets deadline: ${miniArrival <= deadlineMins ? 'YES' : 'NO'}`);
    lines.push(`  ${cab.disclosure}`);
  } else if (!cab) {
    lines.push('CAB OPTIONS: Coordinates unknown — cannot estimate.');
    lines.push('Disclosure: ⚠️ Cab options unavailable for this route.');
  }

  lines.push(`INSTRUCTION: Return all options where "Meets deadline: YES" as ranked routes. If none meet the deadline, return suggested_leave_by (calculated as: deadline minus fastest total journey time).`);

  return lines.join('\n');
}

function extractJson(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch { /* fall through */ }
  }
  const start = raw.search(/[[{]/);
  if (start === -1) return null;
  const slice = raw.slice(start);
  for (let end = slice.length; end > 0; end--) {
    const ch = slice[end - 1];
    if (ch !== ']' && ch !== '}') continue;
    try { return JSON.parse(slice.slice(0, end)); } catch { /* continue */ }
  }
  return null;
}

interface SearchBody {
  source: string;
  destination: string;
  leaving_time: string;
  expected_arrival: string;
}

interface RouteLeg {
  mode: string;
  instruction: string;
  duration_minutes: number;
  cost_inr: number;
}

interface RouteResult {
  total_time_minutes: number;
  total_cost_inr: number;
  legs: RouteLeg[];
  least_congested_window: string;
  most_congested_window: string;
  google_maps_baseline_minutes: number;
}

interface SearchResponse {
  routes: RouteResult[];
  suggested_leave_by?: string;
  reason?: string;
  disclosures?: string[];
  error?: string;
}

app.post('/api/search', async (req: Request<object, object, SearchBody>, res: Response) => {
  const { source, destination, leaving_time, expected_arrival } = req.body;

  if (!source || !destination || !leaving_time || !expected_arrival) {
    res.status(400).json({ error: 'source, destination, leaving_time, and expected_arrival are required' });
    return;
  }

  try {
    const transitContext = buildTransitContext(source, destination, leaving_time, expected_arrival);

    const userMessage = `Search:
- Source: ${source}
- Destination: ${destination}
- Leaving: ${leaving_time}
- Must arrive by: ${expected_arrival}

${transitContext}

Return ALL viable options (train, bus, cab) that beat the walking baseline, ranked by total_time_minutes ascending. Include each mode as a separate route entry. If no option meets the arrival deadline, return suggested_leave_by instead.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('');

    const parsed = extractJson(rawText);
    if (parsed === null) {
      res.status(500).json({ error: 'Model did not return valid JSON', raw: rawText });
      return;
    }

    let result: SearchResponse;
    if (Array.isArray(parsed)) {
      result = { routes: parsed };
    } else {
      result = parsed as SearchResponse;
    }

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.get('/api/saved-routes', async (req: Request, res: Response) => {
  const { device_id } = req.query as { device_id?: string };
  if (!device_id) {
    res.status(400).json({ error: 'device_id is required' });
    return;
  }
  const { data, error } = await supabase
    .from('saved_routes')
    .select('*')
    .eq('device_id', device_id)
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

interface SaveRouteBody {
  device_id: string;
  source: string;
  destination: string;
  leaving_time: string;
  arrival_time: string;
}

app.post('/api/saved-routes', async (req: Request<object, object, SaveRouteBody>, res: Response) => {
  const { device_id, source, destination, leaving_time, arrival_time } = req.body;
  if (!device_id || !source || !destination || !leaving_time || !arrival_time) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  const { data, error } = await supabase
    .from('saved_routes')
    .insert({ device_id, source, destination, leaving_time, arrival_time })
    .select()
    .single();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

app.delete('/api/saved-routes/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { device_id } = req.query as { device_id?: string };
  if (!device_id) {
    res.status(400).json({ error: 'device_id is required' });
    return;
  }
  const { error } = await supabase
    .from('saved_routes')
    .delete()
    .eq('id', id)
    .eq('device_id', device_id); // prevents deleting another user's route
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(204).send();
});

const port = parseInt(process.env.PORT ?? '3001', 10);
app.listen(port, () => {
  console.log(`RouteRight backend running on port ${port}`);
});
