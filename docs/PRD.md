# PRD.md — RouteRight

---

## 1. The Problem Worth Solving

**Who this is for:** Ravi is a 28-year-old mid-level professional in Mumbai who commutes from Andheri to Lower Parel every morning. He leaves at 8:15am. Every day he opens Google Maps for traffic, then Ola to check surge pricing, then Paytm to check train timings, then back to Maps to find the nearest station. By the time he figures out the best option, 10 minutes have passed and he's already stressed. He doesn't need more information — he needs one answer.

**The pain:** Not one app tells him "given your deadline, here's the fastest route combining the local train and a 5-minute walk — and it'll cost you ₹42." He has to synthesize that himself, every single day, while standing on the street.

**What better looks like:** Ravi opens one app, enters where he's going and when he needs to be there, waits 10 seconds, and sees three ranked options with time, cost, and steps clearly laid out. He picks one and goes. Total time: under 60 seconds.

---

## 2. The User Flow

1. User opens the app → lands on the Search screen
2. Source is auto-detected via GPS (or manually entered) → destination entered by typing
3. User enters leaving time and expected arrival time
4. User taps "Find Routes" → **[AI MOMENT 1: Live search + route ranking]**
5. Loading screen appears — live indicator shows "Checking trains... Checking cabs... Checking buses..."
6. Results screen shows up to 3 ranked route cards (time-first, cost-second)
7. User taps a route card to see step-by-step breakdown → **[AI MOMENT 2: Route detail explanation]**
8. If no route beats Google Maps baseline → app shows "To reach by [time], leave by [X] instead"
9. User optionally saves a route → appears in Saved Routes screen
10. User opens app next day → can load a saved route and re-run it with fresh live data

---

### AI Moment 1: Live Search + Route Ranking

**Input:** Source location, destination, leaving time, expected arrival time, current live data from transit APIs

**Output:** Up to 3 route options, ranked by time then cost. Each card shows: total time, total cost (₹), number of transfers, mode icons, and a one-line summary (e.g. "Walk 5 min → Local Train 22 min → Walk 8 min")

**Quality bar:** Every route shown must be faster than the Google Maps baseline for the same journey at the same time. Max 2 transfers per route. Never show a route that requires more than 3 distinct transport modes.

---

### AI Moment 2: Route Detail Explanation

**Input:** Selected route card data

**Output:** Step-by-step breakdown — each leg with mode, duration, cost, and one plain-English instruction (e.g. "Board the 8:34 Churchgate Fast from Andheri. Exit at Dadar.")

**Quality bar:** Instructions must be specific enough that a first-time commuter could follow them without opening another app.

---

## 3. Defining Output Quality

### Always / Never Rules

**The AI must always:**
- Rank routes time-first, cost-second — never flip this order unless the user explicitly filters
- Show total journey time and total cost (₹) on every route card
- Beat the Google Maps baseline or refuse to show the route
- Cap routes at 2 transfers and 3 transport modes
- Include walking legs with duration clearly labeled

**The AI must never:**
- Show a route that takes longer than what Google Maps would suggest for the same trip
- Suggest routes outside 200km from source
- Show more than 3 route options (more is not better — it creates the same paralysis the product is solving)
- Present intercity or highway routes to a commuter who asked for a city commute
- Fabricate train timings — all schedule data must come from the RAG corpus or live APIs only

---

### Quality Examples

**Scenario 1 — Clear commute, moderate distance**

*User input:* Source: Andheri Station, Destination: Lower Parel, Leave: 8:15am, Reach by: 9:00am

*GREAT output:*
> **Route 1** — 34 mins · ₹38
> Walk 4 min → 🚂 Local Train (Andheri→Dadar, 8:22 Fast) 18 min → Walk 12 min
> 🟢 Least congested: 10:00am – 12:00pm
> 🔴 Most congested: 8:00am – 10:00am
>
> **Route 2** — 41 mins · ₹22
> Walk 6 min → 🚌 BEST Bus 442 35 min → Walk 5 min
>
> **Route 3** — 28 mins · ₹180
> 🚕 Ola Mini (direct) 28 min

*Why it's great:* Ranked by time, specific train number shown, cost visible at a glance, walking legs are explicit — no surprises.

*BAD output:*
> **Route 1** — 52 mins · ₹38
> Walk 3 min → Metro Line 1 → Transfer at Versova → Local Train → Transfer at Dadar → Auto → Walk 5 min

*Why it's bad:* 4 transfers, slower than Google Maps, too many modes — exactly the chaos the product is replacing.

---

**Scenario 2 — Tight deadline, peak hour**

*User input:* Source: Borivali, Destination: Churchgate, Leave: 9:00am, Reach by: 9:45am

*GREAT output:*
> ⚠️ Earliest we can get you there: 10:05am
> To reach Churchgate by 9:45am, leave Borivali by 8:38am.

*Why it's great:* Honest. Doesn't show a fake route. Gives the commuter the one actionable answer — when to leave tomorrow.

*BAD output:*
> **Route 1** — 58 mins · ₹42 [shows route that arrives at 9:58]

*Why it's bad:* It silently fails. The user follows the route and is late. Trust is destroyed in one interaction.

---

**Scenario 3 — Short distance**

*User input:* Source: Bandra, Destination: Khar, Leave: 10:00am, Reach by: 10:20am

*GREAT output:*
> 🚶 Walk — 18 mins · ₹0
> It's only 1.4 km. Walking is your fastest and cheapest option.
>
> **Route 2** — 12 mins · ₹60
> 🚕 Ola Auto (direct)

*Why it's great:* Has the confidence to recommend walking. Doesn't pad the results with unnecessary transit options.

*BAD output:*
> **Route 1** — Train from Bandra to Khar + Walk — 24 mins · ₹12

*Why it's bad:* Walking to the station, waiting for a train, and walking out is slower than just walking. The AI optimized for "using transit" instead of optimizing for the user's time.

---

### Edge Cases

**Very short distance (under 500m):** Show walking only. No transit options. One-line message: "You're 400m away. Just walk — it's your fastest option."

**Destination outside 200km:** Hard refusal. "RouteRight is built for Mumbai city commutes. This destination is too far for us to help with right now."

**Ambiguous destination (e.g. "BKC"):** Show a disambiguation prompt with the 2-3 most likely full addresses. Don't guess.

---

## 4. System Type

**Type:** RAG + Tool Calls + Structured Output

**What the system prompt must cover:**
- Role: A precise, no-nonsense Mumbai commute assistant
- Tone: Direct, confident, time-conscious — never chatty
- Output format: Structured route cards (JSON internally, rendered as cards in UI)
- Hard rules: Time-first ranking, 200km limit, never fabricate schedule data
- Few-shot examples: The 3 quality scenarios above

**What the system does NOT need:**
- No memory between sessions (saved routes handled by database, not AI memory)
- No free-form conversation — every interaction is structured input → structured output
- No general travel advice — this is not a chatbot

**Data layer:**
- RAG corpus: Mumbai local train timetables, BEST bus routes, Metro Line schedules — refreshed quarterly with manual override trigger
- Live APIs: Google Maps (traffic + walking), Ola/Uber API (live pricing + ETA)

---

## 5. Constraints

| Constraint | Target | Why it matters |
|---|---|---|
| Search latency | ≤ 10 seconds | Commuter is on the street, possibly late — patience is zero |
| Result display | ≤ 3 route cards | More options recreate the paralysis the product solves |
| Max route complexity | 2 transfers, 3 modes | Routes with more legs are unusable under commute stress |
| Distance limit | ≤ 200km | Beyond this is intercity travel — different product |
| RAG refresh | Quarterly + manual trigger | Mumbai transit changes regularly; stale data breaks trust |
| Cost per interaction | ≤ ₹0.50 (~$0.006) | Must be economically viable at scale for a free/freemium product |
| Location data | Not stored beyond session | Commuter routes are sensitive personal data |
| Output format | Structured JSON → rendered cards | Prevents hallucinated free-text routes |

---

## 6. Assumptions and Risks

| Assumption | Risk if wrong | How to test |
|---|---|---|
| Ola/Uber APIs are accessible and reliable | Live pricing unavailable → cab routes show no cost → partial results | Test API uptime over 2 weeks; set fallback to estimated range (₹X–₹Y) |
| Mumbai local train timetable data is scrapeable/available for RAG | RAG corpus is incomplete → wrong train timings shown → commuter is late | Manually validate 20 random train routes against official CR/WR timetables before launch |
| Commuters will accept a 10-second wait | Drop-off before results → product feels broken | Track % of users who leave before results load; if >30%, reduce to 7s or add better progress UX |
| Time-first ranking matches what users actually want | Users complain results are expensive → cost matters more than stated | Track which route card users pick (1st, 2nd, 3rd); if 2nd/3rd chosen >50%, ranking logic needs revisiting |
| Google Maps baseline is a fair comparison | Google Maps is already optimal → RouteRight never beats it → product has no value | Run 50 manual route comparisons across Mumbai before launch; RouteRight must win or tie on 70%+ |

---

## 7. MVP Scope

**Building in v1:**
- Route search (source, destination, leaving time, arrival time)
- Live search progress indicator
- Up to 3 ranked route cards (time → cost → mode)
- Route detail view (step-by-step breakdown)
- "Leave by" fallback when no route beats Google Maps
- Saved routes (store and re-run with fresh live data)
- Hard refusal for >200km routes
- GPS auto-detect + manual source entry
- Mumbai only

**NOT building in v1:**
- User accounts / login — saved routes stored locally for now; accounts add auth complexity with zero UX benefit at this stage
- Fare splitting — that's a group travel feature; our user is a solo commuter
- Corporate expense reporting — different user, different product
- Multi-city support — Bangalore and Delhi come after Mumbai is proven
- Push notifications ("leave now" alerts) — valuable but requires background processing; v2
- Route history / analytics ("you've saved ₹800 this month") — engagement feature; v2
- In-app ticket booking — partnership complexity; v2
- Real-time disruption alerts (train delays, road closures) — valuable but requires additional data feeds; v2
- Tourist mode — different priorities, different user; v2

---

## 8. Test Set

### Must-Pass Cases

| # | Input description | What great looks like |
|---|---|---|
| 1 | Andheri → Lower Parel, 8:15am leave, 9:00am arrive | 3 routes shown, all faster than Google Maps, Route 1 is train-based, costs visible |
| 2 | Borivali → Churchgate, 9:00am leave, 9:45am arrive (impossible in peak hour) | No routes shown; "Leave by 8:38am" message displayed |
| 3 | Bandra → Khar (1.4km), 10:00am leave | Walking shown as primary option; no unnecessary transit routes |
| 4 | Kurla → Nariman Point, 7:30am leave, 8:30am arrive | Local train + walking combo ranked first; Ola shown as Route 3 with cost |
| 5 | Manual source entry (typed address), Destination: BKC | Disambiguation prompt shown if BKC is ambiguous; correct routes after selection |
| 6 | GPS source, Destination: Dadar, 6:00pm (evening peak) | Results reflect evening peak traffic; cab ETAs updated with surge pricing |
| 7 | Route saved, re-opened next morning | Same route re-runs with fresh live data, not cached yesterday's results |

### Edge Cases

| # | Input description | Expected behavior |
|---|---|---|
| 1 | Destination is 250km away (e.g. Pune) | Hard refusal: "RouteRight is built for Mumbai city commutes. This destination is too far." |
| 2 | Source and destination are the same address | Friendly error: "You're already there." No route generated. |
| 3 | Leaving time is in the past (e.g. 6:00am entered at 9:00am) | Prompt: "Looks like that time has passed — did you mean today at 9:00am or tomorrow at 6:00am?" |

### Must-Fail-Safely Cases

| # | Input description | What safe failure looks like |
|---|---|---|
| 1 | Ola/Uber API is down | Show train and bus routes only; label: "Live cab pricing unavailable right now" — do not crash or show ₹0 |
| 2 | User inputs an abusive or nonsense destination ("asdfgh") | "We couldn't find that location in Mumbai. Please check the name and try again." No route attempted. |
| 3 | RAG returns no matching train route for the journey | Fall back to bus + cab options only; do not hallucinate a train route |
| 4 | Both APIs and RAG fail simultaneously | "We're having trouble finding routes right now. Try again in a moment." Graceful empty state, no crash. |

---

## 9. Observability

### What to Log

| What to log | Why |
|---|---|
| Source + destination (hashed for privacy) | Understand most common routes; inform RAG corpus priorities |
| Leaving time + expected arrival time | Identify peak usage windows |
| Search latency (ms) | Catch performance degradation before users notice |
| Number of routes returned (0, 1, 2, or 3) | Track how often the product fails to find options |
| Which route card user selects (1st, 2nd, 3rd) | Validate that time-first ranking matches actual user preference |
| Whether user saves the route | Measure engagement and saved routes feature usage |
| "Leave by" fallback triggered (Y/N) | Track how often the product can't meet the user's deadline |
| API errors by source (Ola, Uber, Google Maps) | Identify unreliable data sources |
| RAG miss rate | Know when transit corpus needs urgent refresh |
| Cost per interaction (₹) | Monitor unit economics |

### Alerts

| Alert | Threshold | Action |
|---|---|---|
| Search latency | > 12 seconds | Page on-call; investigate API bottleneck |
| Route return rate | < 2 routes returned on >30% of searches | RAG or API data issue; trigger manual review |
| API error rate | Any single API failing >15% of calls | Switch to fallback; notify data team |
| Cost per interaction | > ₹0.75 | Review LLM call frequency; optimize prompts |
