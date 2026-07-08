# Sahani Suite — Travel Planner: Changelog

A running, append-only log of what changed each session. Paste the most
recent entry (or the whole file) into a new chat to give Claude fast
context without waiting on background memory.

---

## 2026-07-06 — Refactor, 5 features, 3 bug fixes

**Refactor**
- Split monolithic `travel-planner.html` (2,846 lines) into 5 files:
  `travel-planner.html` (390-line shell), `core.js` (803), `itinerary.js`
  (999), `adventure.js` (~440), `library.js` (331)
- Verified 84/84 functions accounted for exactly once, no gaps/dupes,
  all pass `node --check`

**Features added**
1. Adventure trips: transit/travel cards can now be added alongside
   stages; both are merged into one timeline
2. Critical/High booking pills (Adventure view) auto-hide once nothing
   outstanding at that priority remains
3. Accommodation phone numbers are click-to-call (`tel:`); addresses
   were already click-to-map
4. Refundable field added to hotel bookings (both stage-level and the
   generic accommodation form)
5. Route Map URL field added to trek stages

**Bug fixes**
- **GitHub sync total failure ("Load failed")**: a `Cache-Control`
  header on the SHA-fetch request forced a CORS preflight that
  `api.github.com` rejects, blocking every sync. Removed; the existing
  `?t=` query-string busting already handled cache invalidation.
- **Silent data loss on concurrent device saves**: on a 409/422
  conflict, the retry only re-fetched the SHA, then blindly re-pushed
  the stale local snapshot — silently overwriting the other device's
  edits to *any* trip, not just the one being fought over. Added an
  optional `mergeFn` param to `syncToGitHub()`/`_doGitHubSync()` in
  `utils.js` (+ new `_ghFetchContent()` helper); travel planner's
  `mergeTravelData()` in `core.js` now reconciles per-trip on conflict.
  **Known gap**: same-trip simultaneous edits still last-write-wins;
  Idea Bank / Lingo Library arrays aren't merge-aware yet.
- **Modal self-closing mid-edit**: dragging to select text at the end
  of a right-aligned `.ios-input` field could overshoot the sheet's
  edge; since a click's target is resolved by mouseup position (not
  mousedown), this fired the backdrop's `onclick="closeSheet()"`
  directly, bypassing `stopPropagation()` entirely. Fixed by adding a
  shared `setupBackdropDismiss(overlayId, closeFn)` helper to
  `utils.js` — only fires if *both* mousedown/touchstart and click land
  on the overlay itself. Travel planner's `core.js` updated to use it.
- **Adventure timeline ignoring time-of-day**: transit cards sorted by
  date only; same-day items fell back to array order (stages always
  first) since no time comparison existed. `getTrekTimeline()` in
  `adventure.js` now sorts by date, then by time (`stage.time`/
  `start_time` vs. transit's `legs[0].depart`), defaulting untimed
  entries to `'00:00'`.

**Open items for next session**
- Port `setupBackdropDismiss()` to the other Sahani Suite apps
  (financial analyser, packing list, etc.) — diffs were provided, not
  yet applied (those files weren't in this session's context)
- Browser smoke-test: two-device concurrent edit scenario (merge fix),
  and confirm the backdrop-dismiss fix on iOS specifically
- Carried over from earlier sessions, status unclear — revisit:
  packing list integration into travel-planner (was mid-debug),
  reusable `packing-template.html`, GitHub PAT scope/403 issue (this
  session's sync bug was a *different* root cause — CORS, not auth —
  so the earlier 403 investigation may still be open)

**Stale convention to update in your own notes**: `travel-planner.html`
is no longer ~2,900 lines — it's now a 390-line shell plus 4 small JS
modules. Any standing instruction that says "ask which section before
requesting the whole file" no longer applies to this app; each file is
small enough to paste or attach whole.

---

## 2026-07-07 — LifeOS homepage + adventure refinements + Horizon export

**New: LifeOS homepage** (`/index.html`)
- Built unified "today" dashboard pulling from all core apps (Travel, Training,
  Recipes, Budget, Horizon) into a three-pillar EAT/RUN/LIVE layout
- **Hero section**: shows destination + today's scheduled activity when a trip
  is currently in progress (computed: `startDate <= today <= endDate`), hidden
  otherwise
- **RUN card**: merges two sources—training session for the day (from
  `training.json`) AND if there's an active trip, any hiking/biking/running
  stage scheduled for today on that trip. Displays discipline via the new
  `activitySubtype` field on stages
- **LIVE section**: toggles between "On Trip" (active trip + days left) and
  "Next Trip" (upcoming trip + T-minus days); Horizon Wealth Runway card shows
  RAG light + portfolio runway age (fetches from private `fatbuoy/app-data`
  repo via existing PAT infrastructure)
- Data contract: all JSON files read as-is (`travel.json`, `training.json`,
  etc.); Horizon data pushed manually via new export button in Assumptions tab

**Adventure.js improvements**
1. **`activitySubtype` field for hiking stages**: new stages now carry
   `activitySubtype: 'hike'` (matching the existing `itinerary.js` convention
   for `run`/`bike`). Existing stages default to `'hike'` on read, so no
   migration needed. Used by LifeOS homepage RUN merge to display discipline
   icon/label
2. **Rounded total km in hero banner**: `Math.round(totalKm)` so decimal-entry
   stages don't produce ugly long-float display (e.g., 27.3 km displays as 27,
   not 27.300000000001)
3. **New `other_info` field on trek stages**: second freeform notes field
   (alongside existing `route_notes`) for gear reminders, permits, etc. Uses
   `notesGroupHtml()` helper (reuses Route Notes styling), defaults to empty
   string on read for backward compat — existing trips unaffected
4. **Collapsing hero on scroll**: when the stage list scrolls down past 40px,
   the trek hero compresses to a slim one-line header showing trip name +
   stage count, freeing mobile screen real estate. Uses a scroll listener on
   `.ios-sheet-body` + CSS class toggle (no position:sticky needed since hero
   already sits outside the scroll container). Listener re-attaches on every
   `renderTrekSheet()` call so no stale-binding risk

**Horizon app enhancements** (local-only, not on GitHub Pages)
- **`core.js`**: new `HORIZON_CONFIG` constant points to
  `fatbuoy/app-data/horizon-summary.json`; new `exportToLifeOS()` function
  collects RAG status from Liquidity tab + runway age from Scenarios tab,
  builds summary payload, calls `syncToGitHub()` (reuses existing utils.js
  infrastructure)
- **Assumptions tab workflow checklist**: new "📤 Export to LifeOS" button
  alongside existing Load/Save/Reset buttons. Click exports current liquidity
  RAG + wealth runway to the private repo; LifeOS homepage reads it on load.
  Structured for future auto-export (currently manual trigger only)

**Implementation notes**
- LifeOS homepage computes active trip as: any trip where
  `startDate <= todayStr && endDate >= todayStr` (date-based, not status
  field). Confirms `trip.itinerary` is the shared stages array across
  adventure.js/itinerary.js (not separate `.stages` property)
- Horizon export uses the *current* scratch-pad params (not a saved scenario),
  so runway reflects whatever retirement ages / expense assumptions are live
  in the Scenarios tab at export time
- No breaking changes: all new fields default to empty/falsy on read, so
  old trips continue to work

**Open items for next session**
- Smoke-test LifeOS on mobile vs desktop (responsive grid, hero collapse UX)
- Verify two-device sync scenario where one device has updated a trip while
  LifeOS was reading it (merge-aware GitHub sync should handle cleanly)
- If Horizon auto-export is desired later: change `exportToLifeOS()` to fire
  on Scenarios tab recalc (one-liner wiring, logic already there)
- Port `setupBackdropDismiss()` to remaining Sahani Suite apps (packing list,
  financial analyser, etc.) — still outstanding from 07-06
