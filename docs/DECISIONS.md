# Decisions Log — RouteRight

---

## How to use this file
After every significant decision during your build, add an entry below.
A "significant decision" = choosing between alternatives, changing your plan, or cutting scope.

### Template
```
### [Date] — [Short title]
**Context:** What prompted this decision
**Options considered:** What alternatives you weighed
**Decision:** What you chose
**Why:** The reasoning
**Revisit if:** Under what conditions you'd reconsider
```

---

## Decisions from the product interview

### May 2026 — Single user segment: daily commuter
**Context:** Product could serve daily commuters, tourists, and corporate travelers
**Options considered:** Build for all three segments; build for tourists first; build for daily commuters first
**Decision:** Daily commuter only for v1
**Why:** Commuters have the sharpest, most repeatable pain — same route, every day, 5 apps open. Tourists and corporate travelers have different priorities and would dilute the ranking logic and UX
**Revisit if:** Mumbai commuter traction is proven and a second segment requests the product with enough volume to justify a separate flow

---

### May 2026 — Single city: Mumbai only
**Context:** Could launch across Mumbai, Bangalore, and Delhi simultaneously
**Options considered:** All three cities at launch; Bangalore first (larger tech commuter base); Mumbai first
**Decision:** Mumbai only for v1
**Why:** Transit data availability varies sharply by city. Mumbai local trains, BEST buses, and Metro have the most structured data to build a RAG corpus from. Spreading across cities in v1 means three half-working products instead of one that actually nails it
**Revisit if:** Mumbai RAG corpus is stable and manual refresh process is proven — then replicate the data pipeline for one new city at a time

---

### May 2026 — Time-first ranking is fixed, not user-configurable
**Context:** Users have different priorities — some want cheapest, some want fastest, some don't care about mode
**Options considered:** Let users set their own priority weighting; offer filter toggles (fastest / cheapest / fewest transfers); fix the ranking as time-first always
**Decision:** Fixed ranking — time-first, cost-second, mode last — no user controls
**Why:** The commuter's stated priority order was unambiguous. Adding filter toggles recreates the decision fatigue the product is trying to eliminate. One answer, ranked correctly, is the product
**Revisit if:** >40% of users consistently tap Route 2 or Route 3 — that's a signal the ranking isn't matching real preferences

---

### May 2026 — No user accounts in v1; device ID only
**Context:** Saved routes need some form of persistence
**Options considered:** Full user accounts with email/phone login; anonymous accounts; device ID only (no auth)
**Decision:** Device ID only — no login, no auth, no PII collected
**Why:** Accounts add auth complexity, friction at first launch, and a privacy surface area that isn't needed yet. Saved routes against a device ID delivers the feature with none of the overhead. If a user changes phones, they lose saved routes — acceptable at this stage
**Revisit if:** Saved routes become a core retention driver and users ask for cross-device sync

---

### May 2026 — RAG corpus for transit data, not pure live API
**Context:** Mumbai train and bus schedules need to be accurate without a guaranteed real-time public API
**Options considered:** Rely entirely on Google Maps for transit routing; build a real-time scraper for CR/WR timetables; use RAG with quarterly refresh + manual override trigger
**Decision:** RAG corpus (Pinecone) with quarterly refresh and a manual override webhook
**Why:** No reliable real-time public API exists for Mumbai local train timetables. Google Maps covers it partially but not with the granularity needed for step-by-step instructions. RAG on structured timetable data gives control over quality — at the cost of needing active maintenance
**Revisit if:** CR/WR or BEST publish a reliable public API — at that point, drop the RAG layer for transit schedules and query live

---

### May 2026 — Mumbai transit data source is unresolved (DAY-ONE BLOCKER)
**Context:** Milestone 3 requires ingesting Mumbai local train, BEST bus, and Metro schedules into Pinecone
**Options considered:** Official CR/WR timetable PDFs (manual); GTFS feeds if available; web scraping; third-party transit data providers (e.g. MoovIt API, Rome2Rio)
**Decision:** Not yet decided — needs resolution before Milestone 3 begins
**Why:** No confirmed data source exists at product definition stage. This is the highest-risk dependency in the entire build
**Revisit if:** N/A — resolve this before writing a single line of Milestone 3 code. Recommended first step: check if Mumbai Metro or BEST publish GTFS feeds; check MoovIt and Rome2Rio for licensing; contact CR/WR for developer access

---

## Decisions made during Milestone 1 build

### May 2026 — M1 transit data: hand-curated static corpus instead of Pinecone RAG
**Context:** Pinecone API key not yet available; RAG blocker needed resolution before M1 could proceed
**Options considered:** Block M1 until Pinecone is set up; hand-curate a minimal corpus as inline static data
**Decision:** Hand-curated Western Railway WR Slow train timings + 2 BEST bus routes (221, 271) embedded directly in server.ts as a string passed to Claude
**Why:** Unblocks M1 immediately. The AI ranking logic is what M1 must prove — the data layer is replaceable. Static data is good enough to validate that Claude returns correct ranked JSON.
**Revisit if:** M2 — swap `getTransitData()` for a real Pinecone query once the key is available and corpus is ingested

---

### May 2026 — M1 Google Maps baseline: hardcoded 58 minutes for Andheri → Lower Parel
**Context:** Google Maps API key not yet available
**Options considered:** Block M1; use Distance Matrix API later; hardcode the baseline for M1 test route
**Decision:** Hardcoded 58 min (4.5km walk, consistent with known distance between these two locations)
**Why:** The baseline validation is important but secondary to proving Claude returns valid ranked JSON. Hardcoded value is accurate enough for the M1 test case.
**Revisit if:** M2 — replace `getTransitData()` and baseline with real Google Maps Directions API call

---

### May 2026 — M2 Pinecone replaced by JSON corpus file (corpus.ts)
**Context:** Pinecone API key unavailable; RAG vector search overkill for small corpus
**Options considered:** Block M2; use SQLite with FTS; hand-curated JSON lookup
**Decision:** TypeScript object keyed by "normalized-source→normalized-dest"; add routes as needed
**Why:** RouteRight's corpus is small, hand-verified, and static between refreshes. A lookup is simpler, faster, and zero-cost. Pinecone adds infra complexity with no query-quality benefit at this scale.
**Revisit if:** Corpus grows beyond ~100 route pairs, or if fuzzy matching on user input becomes necessary

---

### May 2026 — M2 Google Maps baseline replaced by Haversine + road factor
**Context:** Google Maps API key unavailable
**Options considered:** Block; OpenRouteService (needs key for production); Haversine × 1.4 road factor
**Decision:** Haversine formula with 1.4 road factor for distance. Walking baseline unused for routes >5km — deadline check is the gating criterion. Cab speed: 25 km/h peak, 35 km/h off-peak (calibrated against real Mumbai Ola ETAs).
**Revisit if:** Google Maps key becomes available — replace roadDistanceKm() with Directions API call

---

### May 2026 — M2 Ola/Uber replaced by estimated pricing with disclosure label
**Context:** Ola/Uber APIs are closed; no free alternative
**Options considered:** Block; mock with random prices; estimate from Mumbai market rates
**Decision:** Estimate using 2024 Mumbai auto (₹20 base + ₹15/km) and mini cab (₹50 base + ₹12/km) rates with 1.4× peak surge. Always labeled "⚠️ Estimated pricing — live Ola/Uber rates unavailable". Claude includes this label in route instructions.
**Revisit if:** Ola or Uber API access granted — wire into getTransitData() and remove estimation

---

## Decisions made during Milestone 3 build

### May 2026 — GPS autocomplete: Nominatim OSM instead of Google Maps Places
**Context:** M3 requires Mumbai-scoped destination autocomplete; Google Maps Places API key unavailable
**Options considered:** Block M3; Google Places Autocomplete (needs key); Nominatim OSM (free, no key)
**Decision:** Nominatim with `viewbox=72.75,18.85,73.0,19.35&bounded=1` — restricts results to Mumbai bounding box
**Why:** Free, no key required, accurate enough for Mumbai. Bounded bbox doubles as the 200km hard refusal — destinations outside Mumbai simply return no suggestions.
**Revisit if:** Google Maps API key becomes available — swap `geocode.ts`'s `autocomplete()` to use Places Autocomplete API

---

### May 2026 — Search state passed via Expo Router params + module-level store
**Context:** Results and Detail screens need both the search params and the API result
**Options considered:** React Context; Zustand; URL params only; module-level store + URL params
**Decision:** Search params passed as router string params to Searching screen; API result stored in module-level `store.ts` (getResult/getParams); Results and Detail read from store
**Why:** No global state manager needed at this scale. URL params only works for strings (search params), but the route result object is too large/nested for URL encoding. Module-level store is simple, zero-dep, and correct for a linear flow where results never need to outlive a session.
**Revisit if:** Saved Routes feature requires persisting result objects — at that point, swap store for AsyncStorage or Supabase cache

---

## Future Decisions
*(Continue logging here as you build.)*
