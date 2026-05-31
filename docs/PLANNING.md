# PLANNING.md — RouteRight

---

## Screens and Navigation

---

### Screen 1: Search Screen
**URL path:** `/` (home)

**What's on it:**
- App name / logo at top
- Source field — auto-populated with GPS location label (e.g. "Andheri West, Mumbai") with a small GPS icon; tappable to edit manually
- Destination field — text input with Mumbai-scoped autocomplete
- Leaving time — time picker (defaults to current time)
- Expected arrival time — time picker
- "Find Routes" CTA button (full width, primary colour)
- Saved Routes shortcut link below the button ("Your saved routes →")

**Does NOT include:**
- No login / sign-up prompt
- No filter toggles (prefer train / prefer bus) — ranking is always time-first
- No map view
- No recent searches (v2)
- No voice input
- No fare estimate before searching

**Where it connects:** Tapping "Find Routes" → Loading Screen

---

### Screen 2: Loading Screen
**URL path:** `/searching`

**What's on it:**
- Animated progress indicator (spinner or pulsing bar)
- Live status messages cycling through:
  - "Checking local trains..."
  - "Checking BEST buses..."
  - "Checking Metro lines..."
  - "Checking cabs..."
  - "Ranking your best options..."
- Journey summary at top: "Andheri → Lower Parel · Leaving 8:15am"
- Cancel link ("Start over")

**Does NOT include:**
- No partial results shown mid-search
- No ads or promotional content
- No estimated wait time counter
- No map

**Where it connects:** After ≤10 seconds → Results Screen (or Fallback Screen if no valid routes found)

---

### Screen 3: Results Screen
**URL path:** `/results`

**What's on it:**
- Journey summary header: "Andheri → Lower Parel · Leaving 8:15am · By 9:00am"
- Up to 3 route cards, stacked vertically, ranked 1–3
- Each route card contains:
  - Route number badge ("Best", "2nd", "3rd")
  - Total time (e.g. "34 mins")
  - Total cost (e.g. "₹38")
  - Mode icons in sequence (🚶→🚂→🚶)
  - One-line route summary (e.g. "Walk 4 min → Local Train 18 min → Walk 12 min")
  - 🟢 Least congested: [time range]
  - 🔴 Most congested: [time range]
- "Save this route" icon on each card (bookmark)
- "Search again" link at bottom

**Does NOT include:**
- No map view of the route
- No fare breakdown per leg
- No user ratings or reviews
- No ads
- No "share route" button (v2)
- No real-time delay alerts on this screen (v2)

**Where it connects:**
- Tapping a route card → Route Detail Screen
- Tapping bookmark → saves route, shows confirmation toast
- "Search again" → Search Screen

---

### Screen 4: Route Detail Screen
**URL path:** `/results/[route-id]`

**What's on it:**
- Back arrow → Results Screen
- Journey summary header
- Step-by-step leg breakdown, each leg showing:
  - Mode icon + mode name
  - Specific instruction (e.g. "Board the 8:34 Churchgate Fast from Andheri Platform 4")
  - Duration for this leg
  - Cost for this leg (where applicable)
  - Walking distance in metres (for walk legs)
- Total time + total cost summary bar at bottom
- 🟢 Least congested / 🔴 Most congested for full journey
- "Save this route" button

**Does NOT include:**
- No turn-by-turn walking map
- No live train tracker
- No in-app ticket booking
- No "alternatives" shown on this screen — user must go back to Results

**Where it connects:**
- Back → Results Screen
- Save → Saved Routes Screen (or confirmation toast if already there)

---

### Screen 5: Fallback Screen
**URL path:** `/no-results`

**What's on it:**
- Clear headline: "You can't make it by [expected time]"
- Single actionable message: "To reach [destination] by [expected arrival], leave by [calculated time] instead."
- "Adjust your time" button → returns to Search Screen with pre-filled fields
- "Search again" link

**Does NOT include:**
- No partial routes that don't meet the deadline
- No apology copy ("Sorry, we couldn't find...")
- No suggestions to try a different mode

**Where it connects:**
- "Adjust your time" → Search Screen (times pre-filled)

---

### Screen 6: Saved Routes Screen
**URL path:** `/saved`

**What's on it:**
- "Saved Routes" header
- List of saved routes, each showing:
  - Source → Destination label
  - Saved leaving time + arrival time
  - Last used date
  - "Search now" button (re-runs with fresh live data)
  - Delete (swipe or trash icon)
- Empty state: "No saved routes yet. Search a route and tap the bookmark to save it."

**Does NOT include:**
- No route editing (delete and re-search)
- No folders or grouping
- No sharing
- No analytics ("you've saved ₹800 this month") — v2

**Where it connects:**
- "Search now" → Loading Screen → Results Screen
- Back → Search Screen

---

### Overlay States

**Loading overlay (API timeout):**
If search exceeds 10 seconds: "Taking longer than usual... still searching."
If 15 seconds: auto-show Fallback Screen with message "We couldn't get live data right now. Try again in a moment."

**Save confirmation toast:**
"Route saved." — appears for 2 seconds, bottom of screen, no action required.

**GPS permission denied:**
Source field shows: "Enable location access or enter your starting point manually." No crash, no blank field.

**No internet connection:**
Full-screen error state: "No connection. RouteRight needs internet to find live routes." With retry button.

---

## System Prompt

```
You are RouteRight's route ranking engine — a precise, no-nonsense Mumbai commute assistant. Your job is to take structured route data from live APIs and a transit knowledge base and return ranked route recommendations. You do not chat. You do not explain yourself unless asked. You output structured route data only.

ROLE:
You receive: source, destination, leaving time, expected arrival time, and raw route options from Mumbai transit APIs (local trains, Metro, BEST buses, Ola, Uber, Google Maps walking data).
You return: up to 3 ranked routes as structured JSON.

TONE:
Direct. Time-conscious. Zero filler. If the user is going to be late, say so plainly. Never soften bad news with padding.

RANKING RULES (non-negotiable):
1. Rank by total journey time — fastest route is always Route 1. Mode does not affect rank. A 28-minute cab ride ranks above a 34-minute train ride. A 20-minute walk ranks above a 25-minute bus ride. Time is the only criterion for rank — not mode preference, not cost, not number of transfers.
2. If two routes have equal time (within 2 minutes), rank the cheaper one higher.
3. Never show a route that is slower than the Google Maps baseline for the same journey.
4. Never show more than 3 routes.
5. Never show a route with more than 2 transfers or more than 3 transport modes.
6. Never suggest routes beyond 200km from source.

RANKING EXAMPLE (correct):
Input routes: Train 34 mins ₹38 / Bus 41 mins ₹22 / Ola 28 mins ₹180
Correct output order: Route 1 = Ola (28 mins), Route 2 = Train (34 mins), Route 3 = Bus (41 mins)
Wrong output order: Route 1 = Train (34 mins), Route 2 = Bus (41 mins), Route 3 = Ola (28 mins) ← NEVER do this

MANDATORY VERIFICATION STEP — run this before returning any routes array:
1. Sort all routes by total_time_minutes ascending.
2. Identify any group of routes where total_time_minutes values differ by 2 or fewer. Within that group, sort by total_cost_inr ascending.
3. Re-number routes 1, 2, 3 in the sorted order.
4. Confirm Route 1 has the lowest total_time_minutes of all routes. If it does not, your sort failed — redo it.
This step is not optional. Do not trust your initial ranking. Always verify.

OUTPUT FORMAT:
Return a JSON array. Each route object must include:
- total_time_minutes (integer)
- total_cost_inr (integer)
- legs (array of: mode, instruction, duration_minutes, cost_inr)
- least_congested_window (string, e.g. "10:00am – 12:00pm")
- most_congested_window (string, e.g. "8:00am – 10:00am")
- google_maps_baseline_minutes (integer — for validation only, not shown to user)

HARD RULES:
- Never fabricate train timings or bus numbers. Use only data from the RAG corpus or live APIs. If data is missing, omit that leg — do not estimate.
- If no route beats the Google Maps baseline, return an empty routes array and include a suggested_leave_by time instead.
- If the destination is outside 200km, return a refusal flag — no routes.
- If source equals destination, return a refusal flag — no routes.

EXAMPLE 1 — Standard commute (great output):
Input: Andheri → Lower Parel, leave 8:15am, arrive by 9:00am
Output:
[
  {
    "total_time_minutes": 28,
    "total_cost_inr": 180,
    "legs": [
      {"mode": "walk", "instruction": "Walk to Andheri Station", "duration_minutes": 4, "cost_inr": 0},
      {"mode": "local_train", "instruction": "Board 8:22 Churchgate Fast from Andheri. Exit at Lower Parel.", "duration_minutes": 18, "cost_inr": 10},
      {"mode": "walk", "instruction": "Walk to destination", "duration_minutes": 12, "cost_inr": 0}
    ],
    "least_congested_window": "10:00am – 12:00pm",
    "most_congested_window": "8:00am – 10:00am"
  }
]

EXAMPLE 2 — No route beats deadline (safe failure):
Input: Borivali → Churchgate, leave 9:00am, arrive by 9:45am
Output: { "routes": [], "suggested_leave_by": "8:38am", "reason": "peak_hour_congestion" }

EXAMPLE 3 — Short distance (walk-first):
Input: Bandra → Khar (1.4km), leave 10:00am, arrive by 10:20am
Output: Route 1 is walking only. Route 2 is Ola auto. No train route generated — it is slower than walking.

SAFETY RULES:
- If an API returns no data for a mode, omit that mode from results. Do not fill the gap with estimates.
- If all APIs fail, return: { "error": "data_unavailable" } — no routes.
- Never include highway or intercity routes in results.

DEGRADED STATE DISCLOSURE RULES — these are mandatory, not optional:
- If Ola API or Uber API returns an error: set warnings: ["cab_pricing_unavailable"] in the response. The UI will render this as "⚠️ Live cab pricing unavailable right now" above the route cards. Do not omit this silently.
- If Pinecone/RAG returns an empty result or error: set warnings: ["transit_data_unavailable"]. The UI will render "⚠️ Train and bus options unavailable right now — showing cabs only."
- If Google Maps API returns an error: return { "error": "baseline_unavailable" } — do not show any routes without a valid baseline to compare against.
- If multiple sources fail simultaneously: return { "error": "data_unavailable" } — no routes, no partial results.
- Rule: every data source failure must produce a visible disclosure. Silent omission is never acceptable.
```

---

## Design Direction

**Feel:** Functional and calm — like a Bloomberg terminal, not a travel app. Every pixel earns its place. No illustrations, no celebrations, no confetti. The commuter is already stressed — the UI should feel like a capable colleague handing them a clean briefing.

**Colors:**

| Role | Hex |
|---|---|
| Background | `#F7F7F5` |
| Primary text | `#1A1A1A` |
| Muted text | `#6B6B6B` |
| Accent (CTA, Route 1 badge) | `#1B4FFF` |
| Success / Least congested | `#16A34A` |
| Warning / Most congested | `#DC2626` |
| Card background | `#FFFFFF` |
| Border / divider | `#E4E4E4` |
| Error state | `#DC2626` |

**Typography:**
- Font family: Inter (system fallback: -apple-system, sans-serif)
- Body: 15px / 1.5 line height
- Route card headline (time + cost): 20px bold
- Step instructions: 14px regular
- Section headers: 12px uppercase, tracked, muted

**Spacing:**
- Screen padding: 16px horizontal
- Card padding: 16px
- Gap between cards: 12px
- Gap between legs in detail view: 16px

**Reference apps:** Citymapper (information density), Robinhood (card layout simplicity), Zepto (speed-first UX — results feel instant even when they're not)

---

## Implementation Notes

**Tech stack:**
- Frontend: React Native with Expo (iOS + Android from one codebase — commuters are on mobile)
- Language: TypeScript throughout — no plain JS files
- Database: Supabase (saved routes, device ID — no auth for v1)
- AI / LLM: Claude Sonnet via Anthropic API (route ranking + instruction generation)
- RAG: Pinecone (Mumbai transit corpus — local trains, Metro, BEST bus routes)
- Maps + Traffic: Google Maps Platform API (Directions, Distance Matrix, Places Autocomplete)
- Ride-hailing: Ola API + Uber API (live pricing + ETA)
- Backend: Node.js API layer on Railway (all external API calls go server-side — never call Anthropic or Pinecone from the client)

**Technical defaults:**
- Framework: Expo with Expo Router (file-based navigation). TypeScript strict mode on.
- State management: TanStack Query (React Query) for all server calls — handles loading, error, and caching states. React `useState` for form inputs only. No global state manager (Redux, Zustand) needed — the product isn't complex enough to justify it.
- API structure: All AI and external API calls route through the Node.js backend. Four routes cover everything: `POST /api/search` (triggers full route ranking), `GET /api/saved-routes` (fetch by device ID), `POST /api/saved-routes` (save a route), `DELETE /api/saved-routes/:id` (delete). Client never holds API keys.
- Key packages: `@tanstack/react-query`, `expo-router`, `expo-location`, `@supabase/supabase-js`, `@anthropic-ai/sdk`, `@pinecone-database/pinecone`

**Data handling:**
Source and destination are hashed before logging — raw addresses are never stored. Search sessions are stateless; nothing persists beyond saved routes. Saved routes are stored against a device ID (not a user account) in Supabase — no PII collected in v1. RAG corpus is stored in Pinecone with a manual refresh webhook for out-of-cycle updates.
