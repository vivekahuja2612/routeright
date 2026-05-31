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
- For cab options, use EXACTLY the duration_minutes and fare values from the CAB OPTIONS section. Never compute your own cab travel time or cost — the values are pre-computed and authoritative.

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

  if (distKm !== null && departMins !== null && deadlineMins !== null) {
    const walkDuration = Math.round((distKm * 1000) / 80);
    const walkArrival = departMins + walkDuration;
    lines.push('WALKING OPTION:');
    lines.push(`  Road distance: ${distKm.toFixed(1)}km | Duration: ${walkDuration} min → arrives ${formatTime(walkArrival)} | ₹0`);
    lines.push(`  Meets ${expectedArrival} deadline: ${walkArrival <= deadlineMins ? 'YES' : 'NO'}`);
  }

  lines.push(`INSTRUCTION: Return all options where "Meets deadline: YES" as ranked routes. Include walking as a route if it meets the deadline. If none meet the deadline, return suggested_leave_by (calculated as: deadline minus fastest total journey time).`);

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

app.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RouteRight — Mumbai Commute Optimizer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #F7F7F5; color: #1A1A1A; min-height: 100vh; }
    .page { max-width: 480px; margin: 0 auto; padding: 48px 16px 64px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 32px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #6B6B6B; letter-spacing: 0.5px; margin-bottom: 4px; }
    input { display: block; width: 100%; border: 1px solid #E4E4E4; background: #fff; padding: 12px; border-radius: 8px; font-family: inherit; font-size: 15px; color: #1A1A1A; margin-bottom: 16px; outline: none; }
    input:focus { border-color: #1B4FFF; }
    input::placeholder { color: #6B6B6B; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .row .field { margin-bottom: 0; }
    .row input { margin-bottom: 0; }
    .row-wrap { margin-bottom: 16px; }
    button { width: 100%; background: #1B4FFF; color: #fff; border: none; padding: 14px; border-radius: 8px; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 4px; }
    button:disabled { background: #6B6B6B; cursor: not-allowed; }
    button:hover:not(:disabled) { background: #1440cc; }
    .hint { font-size: 13px; color: #6B6B6B; margin-top: -12px; margin-bottom: 16px; }
    #status { margin-top: 32px; }
    .loading { text-align: center; padding: 40px 0; }
    .pulsebar { width: 80%; height: 4px; background: #1B4FFF; border-radius: 2px; margin: 24px auto 20px; animation: pulse 1.4s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
    .loading-text { font-size: 15px; color: #1A1A1A; }
    .card { background: #fff; border: 1px solid #E4E4E4; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .badge { font-size: 12px; font-weight: 700; color: #6B6B6B; }
    .badge.best { color: #1B4FFF; }
    .headline { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
    .summary { font-size: 14px; color: #6B6B6B; margin-bottom: 10px; }
    .congestion { display: flex; flex-direction: column; gap: 4px; }
    .cong-row { font-size: 13px; display: flex; align-items: center; gap: 6px; }
    .dot-green { color: #16A34A; }
    .dot-red { color: #DC2626; }
    .disclosure { font-size: 13px; color: #D97706; margin-bottom: 8px; }
    .error-msg { color: #DC2626; font-size: 15px; text-align: center; padding: 32px 0; }
    .fallback { background: #fff; border: 1px solid #E4E4E4; border-radius: 8px; padding: 24px 20px; }
    .fallback h2 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .fallback p { font-size: 15px; color: #6B6B6B; }
    .fallback .leave-by { font-size: 22px; font-weight: 700; color: #1B4FFF; margin: 12px 0; }
    .section-header { font-size: 12px; font-weight: 600; color: #6B6B6B; letter-spacing: 0.5px; margin-bottom: 12px; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="page">
    <h1>RouteRight</h1>

    <label for="source">FROM</label>
    <input id="source" type="text" placeholder="Enter starting point" />

    <label for="dest">TO</label>
    <input id="dest" type="text" placeholder="Enter destination in Mumbai" />

    <div class="row-wrap">
      <div class="row">
        <div class="field">
          <label for="leaving">LEAVING AT</label>
          <input id="leaving" type="time" value="08:15" />
        </div>
        <div class="field">
          <label for="arrival">MUST ARRIVE BY</label>
          <input id="arrival" type="time" value="09:00" />
        </div>
      </div>
    </div>

    <button id="search-btn" onclick="doSearch()">Find Routes</button>

    <div id="status"></div>
  </div>

  <script>
    const BADGE = ['Best', '2nd', '3rd'];
    const MODE_ICON = { walk:'🚶', local_train:'🚂', bus:'🚌', metro:'🚇', auto:'🛺', cab:'🚕', mini_cab:'🚕' };
    const MSGS = ['Checking local trains...','Checking BEST buses...','Checking Metro lines...','Checking cabs...','Ranking your best options...'];
    let msgTimer, msgIdx = 0;

    function fmt24to12(t) {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      const ap = h >= 12 ? 'pm' : 'am';
      const h12 = h % 12 || 12;
      return h12 + ':' + String(m).padStart(2,'0') + ap;
    }

    function icon(mode) { return MODE_ICON[mode] || '•'; }

    function setStatus(html) { document.getElementById('status').innerHTML = html; }

    function startMsgs() {
      msgIdx = 0;
      setStatus('<div class="loading"><div class="pulsebar"></div><p class="loading-text">' + MSGS[0] + '</p></div>');
      msgTimer = setInterval(() => {
        msgIdx = Math.min(msgIdx + 1, MSGS.length - 1);
        const p = document.querySelector('.loading-text');
        if (p) p.textContent = MSGS[msgIdx];
      }, 1500);
    }

    function stopMsgs() { clearInterval(msgTimer); }

    async function doSearch() {
      const source = document.getElementById('source').value.trim();
      const dest = document.getElementById('dest').value.trim();
      const leaving = fmt24to12(document.getElementById('leaving').value);
      const arrival = fmt24to12(document.getElementById('arrival').value);

      if (!source) { alert('Enter your starting point.'); return; }
      if (!dest) { alert('Enter a destination.'); return; }
      if (!leaving || !arrival) { alert('Enter both times.'); return; }
      if (source.toLowerCase() === dest.toLowerCase()) { alert("You're already there."); return; }

      const btn = document.getElementById('search-btn');
      btn.disabled = true;
      startMsgs();

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, destination: dest, leaving_time: leaving, expected_arrival: arrival })
        });
        const data = await res.json();
        stopMsgs();
        renderResult(data, source, dest, leaving, arrival);
      } catch {
        stopMsgs();
        setStatus('<p class="error-msg">No connection. Check your internet and try again.</p>');
      } finally {
        btn.disabled = false;
      }
    }

    function renderResult(data, source, dest, leaving, arrival) {
      if (data.error) {
        setStatus('<p class="error-msg">Could not find routes right now. Please try again.</p>');
        return;
      }

      if (data.suggested_leave_by) {
        setStatus('<div class="fallback">' +
          '<h2>You can\\'t make it by ' + arrival + '.</h2>' +
          '<p>Leave by</p>' +
          '<div class="leave-by">' + data.suggested_leave_by + '</div>' +
          '<p>to arrive on time.</p>' +
          '</div>');
        return;
      }

      if (!data.routes || data.routes.length === 0) {
        setStatus('<p class="error-msg">No routes found for this journey.</p>');
        return;
      }

      let html = '<p class="section-header">' + source + ' → ' + dest + ' &nbsp;·&nbsp; Leaving ' + leaving + '</p>';

      if (data.disclosures) {
        data.disclosures.forEach(d => { html += '<p class="disclosure">' + d + '</p>'; });
      }

      data.routes.forEach((r, i) => {
        const legSummary = r.legs.map(l => icon(l.mode) + ' ' + l.duration_minutes + 'm').join(' → ');
        html += '<div class="card">' +
          '<div class="card-top"><span class="badge' + (i === 0 ? ' best' : '') + '">' + BADGE[i] + '</span></div>' +
          '<div class="headline">' + r.total_time_minutes + ' min &nbsp;·&nbsp; ₹' + r.total_cost_inr + '</div>' +
          '<div class="summary">' + legSummary + '</div>' +
          '<div class="congestion">' +
            '<div class="cong-row"><span class="dot-green">●</span> ' + r.least_congested_window + '</div>' +
            '<div class="cong-row"><span class="dot-red">●</span> ' + r.most_congested_window + '</div>' +
          '</div>' +
          '</div>';
      });

      setStatus(html);
    }
  </script>
</body>
</html>`);
});

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
if (require.main === module) {
  app.listen(port, () => {
    console.log(`RouteRight backend running on port ${port}`);
  });
}

export default app;
