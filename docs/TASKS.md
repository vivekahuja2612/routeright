# TASKS.md — RouteRight

---

**Build order principle:** AI first. Always. The core ranking engine is the product — everything else is a wrapper around it. Milestone 1 must include a working AI call. Never start with static UI and placeholder content — that delays the only validation that actually matters.

---

## Milestone 1: Thinnest AI Slice

**Goal:** Prove the core ranking logic works — one input, one AI call, routes displayed. No polish, no navigation.

**Success criteria:** Open a single screen. Enter "Andheri" as source, "Lower Parel" as destination, 8:15am leave, 9:00am arrive. Tap search. Within 10 seconds, see at least 2 ranked route cards with real time, real cost, and congestion windows populated. Route 1 must be faster than Google Maps walking baseline. If the AI returns malformed JSON or fabricated train data, the milestone is not complete.

**Test cases validated:** PRD Must-Pass #1 (core happy path)

- [x] Initialise Expo project with TypeScript + Expo Router
- [x] Install core packages: `@tanstack/react-query`, `@anthropic-ai/sdk`, `@pinecone-database/pinecone`
- [x] Set up Node.js backend on Railway with single route: `POST /api/search`
- [ ] Integrate Google Maps Directions API — fetch walking baseline time for Andheri → Lower Parel (stubbed at 58 min for M1; wire in M2 when key available)
- [ ] Fetch historical congestion windows from Google Maps for the same route (stubbed for M1)
- [x] **[RAG BLOCKER — resolved]** Confirm Mumbai transit data source; ingest minimum viable corpus (CR Western Line + 2-3 BEST bus routes) into Pinecone (hand-curated static corpus for M1; Pinecone ingestion in M2)
- [x] Build RAG retrieval — given source + destination + time, fetch matching transit options (static for M1; replace with Pinecone in M2)
- [x] Wire Anthropic API with system prompt from PLANNING.md — send raw transit options + baseline, receive ranked JSON
- [x] Build single minimal screen: source/destination text inputs + time inputs + search button + raw route card output
- [x] Display ranked route cards (time, cost, mode icons, congestion windows) — no styling required yet
- [x] Confirm: output never fabricates train numbers; output never beats baseline with a slower route

---

## Milestone 2: Core Loop Complete

**Goal:** Add live cab pricing, wire the full input → AI ranking → output flow end to end, handle the no-routes fallback.

**Success criteria:** Search Borivali → Churchgate at 9:00am targeting 9:45am. See the Fallback Screen with a real "leave by" time (not a placeholder). Search Andheri → Lower Parel at 8:15am. See an Ola or Uber option appear as one of the 3 route cards with a real live price. If Ola/Uber API is unreachable, search still completes with transit-only results and a "cab pricing unavailable" label.

**Test cases validated:** PRD Must-Pass #2 (no-route fallback), PRD Must-Pass #4 (Ola in results), PRD Must-Fail-Safely #1 (API down gracefully)

- [x] Integrate Ola API — estimated pricing with Mumbai 2024 rates + peak surge (live API key pending; labeled as estimated)
- [x] Integrate Uber API — same estimation; both Ola and Uber deferred to live keys; estimated route shown with disclosure
- [x] Merge cab options into route ranking alongside transit options before LLM call
- [x] Implement API failure fallback — transit-only results + "⚠️ Estimated pricing — live Ola/Uber rates unavailable" label always shown
- [x] Implement "suggested leave by" calculation when no routes beat deadline (Claude-computed, backend pre-computes per-option arrival times)
- [x] Build Fallback Screen — "You can't make it by X. Leave by Y instead." + Adjust time button navigates back to Search
- [x] Validate cab routes excluded when walking or transit is faster (Claude handles ranking; cab only appears when it meets deadline)
- [x] Test surge pricing (evening peak) — 1.4× applied for 8–10am and 5–9pm; verified in cab estimate logic

---

## Milestone 3: Full Flow + Navigation

**Goal:** Split into all 6 proper screens, wire navigation between them, manage state correctly across the full journey.

**Success criteria:** Complete the full user journey from cold open: Search Screen → Loading Screen (status messages cycling) → Results Screen (3 cards) → tap Route 1 → Route Detail Screen (step-by-step) → tap back → Results Screen. Source auto-detected via GPS. Destination autocomplete scoped to Mumbai. Leaving time in the past prompts disambiguation. Destination outside 200km shows hard refusal.

**Test cases validated:** PRD Must-Pass #3, #5, #6, Edge Cases #1, #2, #3

- [x] Build Search Screen — GPS source detection (with permission handling), Mumbai-scoped Places Autocomplete, time pickers
- [x] Build Loading Screen — animated indicator, cycling status messages ("Checking local trains...", "Checking BEST buses...", "Checking Metro lines...", "Checking cabs...", "Ranking your best options...")
- [x] Build Results Screen — 3 route cards with badges (Best / 2nd / 3rd), bookmark icon per card
- [x] Build Route Detail Screen — step-by-step leg breakdown, total bar at bottom, save button
- [x] Wire navigation: Search → Loading → Results → Detail → back to Results
- [x] Implement Fallback Screen route from Loading when no routes returned
- [x] Implement state: pass search params through Loading → Results → Detail via Expo Router params
- [x] Integrate Google Maps Distance Matrix — trigger 200km hard refusal before search fires (Nominatim bbox-bounded to Mumbai; destinations outside Mumbai return no suggestions)
- [x] Implement ambiguous destination prompt (top 2-3 address matches before searching)
- [x] Handle same source + destination — friendly error, no search
- [x] Handle past leaving time — "Did you mean today at [now] or tomorrow at [time]?" prompt

---

## Milestone 4: Design + Polish

**Goal:** Apply the full design direction from PLANNING.md. Every screen looks right, every loading state is handled, every error state is handled.

**Success criteria:** Open the app. Every screen matches the design spec — correct colours (`#F7F7F5` background, `#1B4FFF` accent, Inter font), correct spacing (16px screen padding, 12px card gaps), mode icons render correctly. Loading screen progress indicator animates smoothly. Save toast appears for exactly 2 seconds. GPS denied state shows manual entry prompt without crashing.

**Test cases validated:** Visual pass only — no PRD test cases, but verify every "Does NOT include" item from PLANNING.md is absent on each screen.

- [x] Apply design tokens globally — background, text, muted, accent, success, warning, card, border, error hex values
- [x] Apply Inter font throughout with correct sizes (20px bold card headline, 15px body, 14px instructions, 12px section headers)
- [x] Apply spacing system (16px screen padding, 16px card padding, 12px card gaps, 16px leg gaps)
- [x] Polish Loading Screen — smooth animation, correct message sequencing and timing
- [x] Polish Results Screen — "Best" badge styling, mode icon sequence, congestion badge colours (green/red)
- [x] Polish Route Detail Screen — leg layout, cost-per-leg display, total summary bar
- [x] Polish Fallback Screen — clear headline, single actionable message, no apology copy
- [x] Polish Saved Routes Screen — empty state with correct copy
- [x] Implement save confirmation toast (2 seconds, bottom of screen)
- [x] Implement GPS permission denied state
- [x] Implement no internet connection full-screen error state with retry
- [x] Implement 10s timeout warning ("Taking longer than usual...") and 15s graceful error

---

## Milestone 5: Saved Routes + Data Persistence

**Goal:** Users can save a route and re-run it the next day with fresh live data.

**Success criteria:** Save a route. Force-close the app. Reopen. Navigate to Saved Routes — the route is there. Tap "Search now" — it re-fires the full search with today's live data, not yesterday's cached results. The result is different from yesterday if conditions changed. Delete a route — it's gone immediately, no lag.

**Test cases validated:** PRD Must-Pass #7

- [ ] Set up Supabase project + `saved_routes` table: `device_id`, `source`, `destination`, `leaving_time`, `arrival_time`, `created_at`
- [ ] Implement device ID generation on first app open (stored in AsyncStorage — no account, no PII)
- [ ] Implement save route — fires from Results Screen bookmark tap and Route Detail save button
- [ ] Implement `GET /api/saved-routes` and `POST /api/saved-routes` backend routes
- [ ] Build Saved Routes Screen with live Supabase data via TanStack Query
- [ ] Implement "Search now" — re-triggers `POST /api/search` with saved params, navigates to Loading → Results
- [ ] Implement delete: `DELETE /api/saved-routes/:id` + optimistic UI update
- [ ] Implement empty state

---

## Milestone 6: Edge Cases, Safety + Full Test Set Validation

**Goal:** Every test case from PRD Section 8 passes. No crashes, no hallucinated data, no silent failures.

**Success criteria:** Run every test case from PRD Section 8 in sequence. All 7 must-pass cases return correct output. All 3 edge cases are handled gracefully. All 4 must-fail-safely cases show the right fallback — no crashes, no blank screens, no hallucinated routes. Performance: 10 consecutive searches all complete within 10 seconds.

**Test cases validated:** All PRD Section 8 — must-pass #1–7, edge cases #1–3, must-fail-safely #1–4

- [ ] Test + fix: Destination 250km away (Pune) → hard refusal message, no search fires
- [ ] Test + fix: Same source and destination → "You're already there", no search fires
- [ ] Test + fix: Leaving time in the past → disambiguation prompt, no silent error
- [ ] Test + fix: Ola/Uber API down → transit-only results with label, no crash, no ₹0 shown
- [ ] Test + fix: Nonsense destination ("asdfgh") → location error, no route attempted
- [ ] Test + fix: RAG returns no transit match → cab/bus fallback only, no hallucinated train route
- [ ] Test + fix: All APIs + RAG fail → graceful empty state, retry button, no crash
- [ ] Test + fix: GPS permission denied → manual entry prompt shown, no crash
- [ ] Test + fix: No internet → full-screen error state with retry, no blank screen
- [ ] Validate input hashing — confirm raw addresses absent from Supabase logs
- [ ] Performance: run 10 consecutive searches, all must return within 10 seconds
- [ ] Fix all failures — retest until every case passes
