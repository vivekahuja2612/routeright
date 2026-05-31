# CLAUDE.md — RouteRight

---

## Product Context

RouteRight is a Mumbai commute optimizer for daily commuters who waste 10+ minutes every morning juggling Google Maps, Ola, Uber, and Paytm to answer one question: "How do I get to work?" The user enters source (GPS or manual), destination, leaving time, and expected arrival time. The AI queries live ride-hailing APIs and a RAG corpus of Mumbai transit schedules, then returns up to 3 ranked route options — time-first, cost-second — each with total time, total cost, step-by-step instructions, and congestion windows. If no route beats the Google Maps baseline, the app tells the user when to leave instead. Hard limit: 200km. Mumbai only. Saved routes are the only persistence feature in v1.

**Core user flow:**
1. User enters source + destination + leaving time + expected arrival time
2. User taps "Find Routes" → loading screen shows live search status
3. [AI MOMENT] RAG + live APIs queried → LLM ranks up to 3 routes
4. User sees ranked route cards (time, cost, congestion windows)
5. User taps a card → sees step-by-step breakdown
6. User optionally saves route → re-runs with fresh data next day

---

## AI Behavior Rules

**The AI always:**
- Ranks routes by total time only — fastest is Route 1, regardless of mode. A 28-min cab beats a 34-min train. Mode never affects rank.
- Uses cost as tiebreaker only when two routes are within 2 minutes of each other — cheaper wins within that window
- Verifies final ranking by re-sorting all routes by total_time_minutes ascending before output — never trusts initial order
- Beats the Google Maps baseline or refuses to show the route
- Shows congestion windows (least + most congested times) on every route card
- Returns a "leave by" time instead of results when no route meets the deadline
- Discloses every data source failure explicitly: Ola/Uber down → "⚠️ Live cab pricing unavailable right now"; RAG down → "⚠️ Train and bus options unavailable right now"; Google Maps down → error state, no routes shown

**The AI never:**
- Shows more than 3 routes or routes with more than 2 transfers / 3 modes
- Fabricates train timings, bus numbers, or platform information — RAG or API data only
- Suggests routes beyond 200km from source
- Returns partial or estimated data without clearly labelling it as such
- Silently omits a mode without explaining why — every absent mode needs a disclosure label

---

## Coding Behavior Rules

**1. Think before coding. Surface tradeoffs. Never assume.**
- State your assumptions explicitly before writing any code
- If a requirement has two valid interpretations, name both and ask — don't pick silently
- If a simpler approach exists, say so and recommend it
- If something in the spec is unclear, stop and ask — don't invent a solution

**2. Simplicity first. Minimum code that solves the problem.**
- No features beyond what's in PRD.md
- No abstractions built for hypothetical future use
- No "flexibility" or "configurability" that wasn't asked for
- If you write 200 lines and it could be 50, rewrite it

**3. Surgical changes. Touch only what you must.**
- Don't improve adjacent code, comments, or formatting you didn't touch
- Don't refactor things that aren't broken
- Match existing code style exactly, even if you'd do it differently
- If you spot unrelated dead code, mention it — don't delete it

**4. Stay aligned with specs. Always.**
- Before starting any milestone, re-read TASKS.md and PRD.md — use the current version, not memory
- Never add screens, fields, buttons, or UI elements not listed in PLANNING.md
- Never add a feature because it "seems useful" — if it's not in the PRD, it doesn't exist yet
- When in doubt, check the spec. If the spec doesn't cover it, ask before building

**5. Use your engineering judgment.**
- For any technical decision not covered in these specs — package choices, file structure, naming conventions, implementation patterns — make the call yourself. Don't ask the PM about engineering details.
- If a decision has product implications (changes what the user sees or experiences), flag it first
- If it's purely technical, pick the best option and move on

---

## File Locations

| File | Purpose |
|---|---|
| `/docs/PRD.md` | What we're building, quality bar, test set, constraints |
| `/docs/PLANNING.md` | Every screen, the system prompt, design tokens, tech stack |
| `/docs/TASKS.md` | Build order — milestones with success criteria and test case references |
| `/docs/CLAUDE.md` | This file — persistent rules the coding tool reads every session |
| `/docs/DECISIONS.md` | Log of every significant decision made during build |
