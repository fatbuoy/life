# Spend Analyser — Changelog & Session History

Companion to `SPEND_ANALYSER_CONTEXT.md`. This file is the detailed "how and why" log — narrative write-ups of each session's changes, resolved tech debt, and the full shipped-features backlog history.

**Not for pasting into new sessions by default.** The context doc has everything needed to safely make the next change. Pull this file in only when you (or Claude) need to know why a past decision was made, or want to review what shipped in a prior session.

Entries are in reverse-chronological order (most recent session first).

---
## [Session — 2026-02-02] Sortable transaction drawer columns + Merchant column for Flows

**Trigger**: reviewing "Business Expenses" transactions on the Income tab (reconciling
company reimbursements) needed the merchant name, which the shared drill-down drawer
didn't show once opened from the Category→Sub-Category→Remark accordion (unlike the
Merchants tab, where the drawer's *title* already is the merchant).

**Changed — `expense-merchants-tab.js` (shared drawer builder)**:
- `openTxnDrawer()` now takes a per-caller `columns` array (`{key, label, num, sort(a,b),
  defaultDir}`) and a `defaultSort`, replacing the old hardcoded 7-column `<thead>`.
- Column headers are clickable: first click sorts by that column (`defaultDir`, else
  ascending), second click on the same column flips direction. New `_renderTxnDrawerHead()`/
  `_renderTxnDrawerBody()` hold sort state (`_txnDrawerSort`) and re-render in place.
- Default sort is always `{key:'date', dir:'desc'}` — no change to the existing
  most-recent-first behavior (KDD §12) unless a header is clicked.
- `openMerchantDrilldown()` updated to pass its existing 7 columns as comparators; no
  behavior change for the Merchants tab beyond gaining sortability.

**Changed — `expense-flows-core.js`**:
- `openFlowDrilldown()` adds an 8th column, **Merchant**, positioned right after Date.
  Orig/CHF Amount comparators close over `cfg.flipSign` locally (the shared drawer has
  no sign-flip concept).

**Changed — `expense-tracker.css`** (targeted fix, added by user after testing across
multiple years of data caused horizontal scroll):
```css
.merchant-drawer-table th.merchant-col, .merchant-drawer-table td.merchant-col {
  width: 160px; max-width: 160px; overflow: hidden; text-overflow: ellipsis;
}
```
Mirrors the existing `.notes-col` width-cap pattern.

**Scoped out of this session**: extending the Merchants tab's "+ Business expenses"
fold-in toggle to the Monthly tab (raised by user, agreed as a separate session —
Monthly currently sources only `S.actuals`, so business-expense rows folded into
Income never surface there). Flagged in Known Tech Debt / Phase 2 Ideas as the next
session's target.

## [Session — 2026-08-29] Merchants drawer Remarks column truncation

Fixed: the transaction drawer's Remarks column (Merchants tab) had no
truncation at all, unlike its Notes sibling — could overflow the table
against .merchant-drawer-table's white-space:nowrap rule. Added a
`.remarks-col` CSS class (180px, ellipsis) mirroring `.notes-col`, and
applied the same JS-side hard-truncate + title-tooltip pattern already
used for Notes (30 chars for Remarks vs. 20 for Notes, since Remarks is
the primary transaction description field).

Flagged, not fixed: expense-flows-core.js's openFlowDrilldown() shares
the same drawer builder and may have the same gap in its own
rowRenderer — unchecked this session, file wasn't in context.

Files touched: expense-merchants-tab.js, expense-tracker.css.

## [Session — 2026-08-29] `.num-private` cleanup verification — no action needed

Audited index.html, expense-dashboard.js, expense-budget-tab.js,
expense-insights-tab.js, and expense-merchants-tab.js for leftover
`class="num-private"` markup left over from the pre-fmtCHF/fmtNum
CSS-blur privacy approach. Found none — the app's own files never
carried the stray attribute in the first place; only base.css §17's
rule definition is unused (and stays, since base.css is a shared
suite file outside this app's ownership). Closed out as a Known Tech
Debt item with no code change required.

## [Session — 2026-08-27] — Collapsed `openMerchantDrilldown()`/`openFlowDrilldown()` into a shared transaction-drawer builder
 
**Tech debt cleanup.** `openMerchantDrilldown()` (`expense-merchants-tab.js`) and `openFlowDrilldown()` (`expense-flows-core.js`) built two near-identical slide-in drawers — same column shape (Date, Category, Sub-Category, Orig Amount, CHF Amount, Remarks, Notes, per KDD §5), same `.drawer-overlay`/`.slide-drawer.drawer-wide` markup, same Book-Date sort, just assembled twice with separate DOM ids.
 
**What changed:**
- New shared builder in `expense-merchants-tab.js`: `ensureTxnDrawer()` / `openTxnDrawer(rows, {title, meta, heroAmt, rowRenderer})` / `closeTxnDrawer()` / `_sortByBookDateDesc()`. Single drawer DOM instance (`#txnDrawer`/`#txnDrawerOverlay`) replaces the old `merchantDrawerOverlay`/`merchantSlideDrawer` and `flowDrawerOverlay`/`flowDrawer` pairs.
- Row-level formatting stayed **local to each caller** via a `rowRenderer(row)` callback — Merchants' business-expense row highlighting and Flows' signed-amount coloring are genuinely different logic, not duplicated markup, so they weren't forced into one generic template.
- `heroAmt` is optional on the shared builder: Merchants passes a formatted total (own big line under the title, matching old behavior); Flows passes `null` (total stays folded into the meta line, matching old behavior). No visual change for either tab.
- `openMerchantDrilldown()` / `openFlowDrilldown()` / `closeMerchantDrilldown()` / `closeFlowDrilldown()` all kept their exact original signatures and names as thin wrappers around the shared builder — zero changes needed at any call site (Dashboard, Monthly tab month drill-down, the Flow tab's own accordion onclick strings).
- Removed the duplicate `keydown`/Escape listener that lived in `expense-flows-core.js` — one shared listener (in `expense-merchants-tab.js`) now closes the drawer regardless of which tab opened it.
- Both files verified with `node --check`.
**Net effect:** ~110 fewer lines of duplicated drawer-construction code across the two files combined (exact DOM markup, header wiring, empty-state row, sort logic). No behavior or visual change for the user in either tab.
 
**Flagged for verification (not done this session):** the old drawer element ids (`merchantDrawerOverlay`, `merchantSlideDrawer`, `flowDrawerOverlay`, `flowDrawer`, plus their child ids) are retired in favor of `txnDrawer*`. Confirmed `expense-tracker.css` only targets these via classes, never ids, so styling is unaffected — but `index.html` wasn't in scope this session, so if anything there references the old ids directly, it'd need a quick sweep.
 
**Context doc updates:** KDD §5 rewritten to describe the shared builder; KDD §13's cross-file reuse list updated; the "Two drill-down UI shapes coexist" Known Tech Debt item narrowed to just the Travel-vs-flat-table distinction (the Merchants/Flow half is resolved); the matching Phase 2 parking-lot item removed.
 
**Next up (not started):** FX tab removal — identified as the next high-value pure-deletion item, superseded by the Insights tab's Currency Breakdown table. Touch points: nav/`switchTab()` array, `_tabRenderers()`, `onSharedYearSelect()`, `index.html` panel markup.

## [Session — 2026-08-27] FX tab removal

**Motivation:** The FX tab's functionality was fully superseded by the Currency Breakdown table added to the Insights tab in Phase 2. Removing it eliminates a dead file and cleans up all associated state/wiring.

**Changes:**
- `expense-fx-tab.js` — deleted
- `expense-core.js` — removed `S.fxSelectedYear`; removed `fx: renderFX` from `_tabRenderers()`; removed `fxSelectedYear` assignments from `startAnalysis()` and `onSharedYearSelect()`; removed `'fx'` from `switchTab()`'s `names` array and its year lookup (also corrected `names` order to match current nav button order, which had drifted since Income/Savings were added)
- `index.html` — removed FX nav button, `#tab-fx` panel, and `expense-fx-tab.js` script tag


## Session: Budget Planner rehaul — hierarchical accordion, Schedule Pill, YoY Suggested figure, budget-vs-actual, loader-compatible CSV

Full rehaul of the Budget Planner tab from a flat table into a hierarchical accordion, plus a fix to a real cross-tab bug found along the way.

**Structure & UX**
- Replaced the 6-tile KPI row with 3 (Last Year Actuals baseline / New Budget Plan / Variance to Last Year), and a category accordion (collapsed by default, Expand All/Collapse All control) in place of the flat table.
- Added a **Budget Mix** proportional stacked-bar chart (planned vs. last year's actual category mix) — segments and legend rows are clickable, jumping to and expanding that category in the accordion below.
- Reference cells (Last Year/3yr Avg/Suggested) now show a figure in the *same unit* as the row's own input (per-occurrence primary, annual as a small secondary line), avoiding mental ÷12 math.
- Replaced native number-input spinners (`type="number"`) with `type="text" inputmode="decimal"` plus a Swiss-thousand-separator-tolerant parser.
- Replaced the old wall-of-text `title="..."` tooltip with a click-to-open/close info popup.
- Removed the "Auto-fill from 3yr Avg" button entirely.
- Removed a plan-progress-bar-under-KPIs addition partway through the session (redundant with the KPI tiles).

**Data model change — Schedule Pill**
- Sub-category rows: replaced the Mo/An toggle + month `<select>` with a Schedule Pill (🔄 Every Month / 🎯 single lump / 📅 custom) opening a modal month-picker.
- Underlying storage changed from `{amount, freq, month}` (annual total + display frequency) to `{perOcc, months}` (per-occurrence amount + explicit month list) — subsumes monthly/annual/quarterly/biannual as one mechanism instead of a binary. `_detectSchedule()` replaces `_detectFrequency()`: ≥10 active months in 3yr history → every month, else the exact active-month set.
- Category-level entries deliberately kept the simpler `{amount, freq}` model (no schedule of their own — they only exist to be distributed top-down).
- Legacy plans migrate automatically on load.

**Suggested figure — methodology fix**
- Diagnosed and fixed a real bug: the old Suggested figure stacked a p75-volatility pad *and* a CAGR/CPI uplift, double-padding volatile lines (~20% above the 3yr average, unrelated to either Swiss CPI or the user's own Personal Inflation Index).
- New formula: `Last Year × (1 + average of the last two YoY growth rates)`, clamped to [-15%, +25%], falling back to a single YoY rate or CPI. p75 logic remains valid for Insights' own Budget Anchors, just removed from this figure.

**Last Year: actual vs. budget**
- Added budget-vs-actual to the Last Year reference column, via `getBudget(year)`.
- **Bug found and fixed**: initially called `getExpenses(S.budget, year)`, which is actuals-specific internally and silently returned nothing for `S.budget` — every line showed "No budget set" regardless of real data. Now documented as Key Design Decision #20.
- **Second bug found and fixed**: category-row totals were summing sub-row-level budget matches, which missed categories (Vacation & Travel, Other Expenses) whose historical budget is a category-wide lump sum with no `_subcat` attached. Category totals now query `S.budget` filtered by category alone.

**CSV export — rewritten for loader compatibility**
- `exportBudgetPlanCSV()` previously output a simplified summary shape. Rewritten to match the Expense Loader's actual raw CSV input format exactly (`Date, Recipient / Order issuer, Account name, Account no., Ccy, Orig Ccy, Booking text, FXKEY, FX, Amount, Source, Group, Category, Sub-Category, Remark, Book Date, Notes`), one row per (category, sub-category, scheduled month) — verified against real sample rows, including the Excel-serial-date math.
- **Known gap**: Expense-only — this tab has never sourced categories from Savings, so Savings-category budget lines (e.g. `Property & Fixed Assets`) aren't in the export.

**Housekeeping**
- Comments trimmed significantly at the user's request (~1000 → ~880 lines) — verbose rationale blocks cut to 1-3 lines, no logic changes.

### Resolved Known Tech Debt
- ~~Budget Planner's Suggested-amount magnitude is under user review~~ — root cause found (p75+CAGR double-padding) and fixed with a new YoY-based formula.
- ~~Frequency auto-detection threshold (`_detectFrequency()`, ≤2 active months ⇒ annual) is a first guess, unverified~~ — superseded by `_detectSchedule()` (see above); the "unverified against real data" caveat carries forward to the new mechanism.
- ~~The table's "3yr Avg" and "Suggested" columns now show genuinely different numbers (previously a duplicate-column bug)~~ — carried forward correctly through this session's rewrite.

### New Known Tech Debt
- `_detectSchedule()`'s ≥10-active-months heuristic is unverified against real data (same caveat class as its predecessor).
- Budget Planner's category-level entries deliberately don't use the Schedule Pill (kept on the simpler Mo/An model) — intentional asymmetry, flagged in case it needs revisiting.
- Schedule Pill icons (🔄🎯📅) and the info popup use plain emoji, breaking the app's inline-SVG icon convention.
- CSV export's `Account name: 'Monthly'` label covers every 2-12 occurrence schedule, not confirmed against the loader's actual parsing needs for e.g. a biannual line.
- Three independent, unreconciled variance/budget-status color threshold scales now exist across the app (Dashboard accordion bars, Dashboard hero progress bar, Budget Planner's variance pill).

## Session: Insights Growth table — Total row
**Date: 2026-08-24**
**What shipped:**

Added a **Total row** to the bottom of the Insights tab's Year-over-Year
Growth table (§1) — same shape as a category row (per-year totals,
YoY% columns, CAGR), but summed across all categories via the existing
`_computeYearValue(allExpenses, () => true, ...)` pattern. Answers "what
was the overall change 23→24, 24→25..." and "what's my overall CAGR"
directly from the table, without needing to cross-reference the Personal
Inflation Index KPI above it.

Purely additive — no new DOM ids, no `index.html` changes. Also removed a
small redundancy while in there: the Personal Inflation Index KPI's
`yearTotals` was previously computed a second time via a duplicate
`_computeYearValue(..., () => true, ...)` call further down the function;
it now reuses the Total row's `totalYearVals` directly, so the table row
and the KPI figure are guaranteed to be the same number rather than two
separately-computed totals that happen to agree.

## Session: Category accordion budget-status thresholds
**Date: 2026-08-24**
**What shipped:**
Small fix to the Dashboard's Spend by Category accordion. The bar colour previously went amber at 85% of budget and red at 100% — flagging categories amber/red before they'd actually gone over. Changed to a tolerance-based scale: green through 5% over budget, amber beyond 5% over, red beyond 15% over. Scoped to `renderDashCategories()` only — the hero card's own progress bar (`fillClass`) still uses the old 85%/100% scale, left as-is since it wasn't part of the request.

**Resolved Known Tech Debt**: none (no existing tech-debt item covered this).

## Session: Trend tab — sticky category column + Amount/% of Total toggle
**Date: 2026-08-24**
**What shipped:**
Two small Trend tab enhancements, both scoped entirely to `expense-trend-tab.js`
plus one opt-in CSS addition — no `index.html` changes needed.

- **Sticky first column**: the Category/year table's Category column now stays
  fixed while the year columns scroll horizontally underneath it. Implemented
  as a new generic, opt-in `.sticky-col1` class in `expense-tracker.css`
  (applied to the `<table>` element via JS in `buildTrendTable()`, not hardcoded
  in markup), so it's reusable by any future table with the same shape without
  affecting existing tables.
- **Amount / % of Total toggle**: a new segmented control above the table lets
  the user switch each cell between the raw CHF amount and that category's
  share of the column total. Built via the same "construct once, insert as
  sibling, flip `.active` on render" idiom as the Insights tab's YTD/Annual
  toggle (KDD §11) — `_ensureTrendTableToggle()`, state in module-level
  `_trendTableView` ('amount'|'pct'), not persisted, not reset by the year
  strip (consistent with existing tab-local filter state, KDD §3).
  - In % mode, body cells show a category's share of **that year's column
    total**; the Total column shows share of the grand total. The footer
    (Total) row always stays in CHF — it's the denominator the percentages
    are relative to.
  - Percentages are not run through the privacy masking formatters — they
    don't expose absolute amounts, so masking them wasn't judged necessary.

## Session: Insights tab — CPI window bug fix, YTD/Annual toggle, complete-months audit, Currency Breakdown table
**Date: 2026-08-24**
**What shipped:**

- **Fixed a real bug in the Personal Inflation Index vs. CPI comparison.** The headline Personal Inflation Index figure and the figure actually used to compute the Difference KPI could silently come from two different year windows — the headline always used the full window, but Difference recomputed Personal CAGR over a shorter window whenever the latest year's CPI hadn't been published yet. The Difference shown was never a simple subtraction of the two numbers on screen, which is what surfaced this (a -1.7% Personal figure and a +0.6% CPI figure that produced a nonsensical +2.4pts). Fixed by unifying the window: whenever a CPI comparison is possible, the Personal Inflation Index shown IS the figure for that same window, so Difference is always exactly Personal − CPI.
- **Added a shared YTD/Annual toggle** above the Growth table, driving both it and the Discretionary vs. Fixed Ratio table below it. YTD truncates every year to the last *complete* month (previously used "latest month with any data," which let a barely-started month distort every year's comparison). Annual shows full-year totals for finished years and, for the still-running year, an actual-through-boundary + budget-for-the-remaining-months forecast — the same blend as the Dashboard's `forecastEOY`, now computed per category/tag via a new shared `_computeYearValue()` helper. Defaults to YTD.
- **Complete-months audit across the rest of the tab**: Budget Anchors and Creeping Costs now exclude the still-running current month from their full-history calculations (previously a barely-started month read as an artificially quiet one and skewed volatility/averages downward). The Spend by Currency pocket planner now averages only fully-complete years rather than folding a partial current year in as if it were a full one.
- **New Currency Breakdown table** in the Spend by Currency section: Orig Amount, CHF Equivalent, Avg FX Rate (blended effective rate), Txns, and % of Total per currency, following the tab's year selector. Deliberately uses uncut actuals (like the Dashboard's Total Spend, it's meant to show real spend-to-date, not an average). Both amount columns mask correctly under Privacy mode — unlike the standalone FX tab's original-currency column. Judged to bring in enough detail to make the FX tab a genuine prune candidate (not removed this session — see Phase 2 Ideas for what that would touch).

**Replaced**: `_getYearScopedExpenses()` → `_getInsightsWindow()` + `_computeYearValue()` (Growth table, Discretionary table).

**Resolved Known Tech Debt:**
- ~~Insights' Budget Anchors and Creeping Costs sections don't use the new complete-months-only logic (Key Design Decision #17) — both still run over full trailing history regardless of whether the most recent month is a partial one.~~ Both now exclude the still-running current month.

**New Known Tech Debt:**
- Insights' Annual/forecast view depends on `S.budget` having per-category, per-month rows for the still-running year; thin/missing budget data means forecasted remaining months read as CHF 0 for that category/tag (same fallback as the Dashboard).
- Currency Breakdown table's ccy-badge fallback list (`_CCY_BADGE_CLASSES`) is a small local copy, kept separate from `KNOWN_CCY` in `expense-merchants-tab.js` rather than depending on its exact shape (that file wasn't opened this session) — worth reconciling if a new currency ever shows an unstyled badge.

**Files touched:** `expense-insights-tab.js` (full rewrite of the Growth/Discretionary/FX-Pockets logic, new `_renderFXTable()`), `index.html` (new Currency Breakdown table container in the Insights tab panel, refreshed Budget Anchors/Creeping Costs static notes). `expense-core.js` and `expense-dashboard.js` were referenced for `getLastCompleteMonth()`/`forecastEOY` but not modified.

## Session: Complete-Month Data Fixes, expense-charts.js Split, Monthly Tab Deep Link
**Date: 2026-08-24**

Three pieces of work, one session:

**1. Dashboard forecast/average/variance figures now ignore incomplete months.** A CSV export refreshed mid-month (e.g. only 3 days of the newest month captured) was being counted as a *finished* month everywhere the Dashboard averages or projects — `avgMonthly` was diluted by a near-empty month in its denominator, `forecastEOY` skipped adding that month's budget because its (tiny) actual was mistaken for the whole month, and every category's over/under looked artificially "under budget" because the budget baseline (`elapsedMonths`) included a month that had barely started. Added `getLastCompleteMonth()`/`_getMaxDataDate()` to `expense-core.js`: it reads the latest `Book Date` actually present in `S.actuals` and treats a month as complete once data exists through at least its 28th calendar day (rolling back one month otherwise). This replaced the previous `new Date()`-based checks in `expense-dashboard.js`, which trusted the calendar instead of the data. The headline **Total Spend** figure is deliberately untouched — it still shows the real actual-to-date total, partial current month included.

**2. Split the canvas chart library out of `expense-core.js` into a new `expense-charts.js`.** Resolves the "`expense-core.js` length" Known Tech Debt item — that file had grown large enough to be an expensive upload every session on the free tier. Moved `_cssVar`, `prepCanvas`, `drawGridY`, `drawGridYRight`, `drawBarLineChart`, `drawMultiLineChart`, `drawStackedBarChart` verbatim, no logic changes. **Requires an `index.html` update**: `<script src="expense-charts.js"></script>` must load immediately after `expense-core.js` and before every tab file (see Key Design Decision #13).

**3. Dashboard → Monthly tab deep link.** Clicking a bar on the Dashboard's category side-panel chart ("All Categories — Monthly Trend", `dashCatChart`) now switches to the Monthly tab with that month's drill-down already open, via `drawBarLineChart`'s existing `opts.onBarClick` support plus a new `openMonthInMonthlyTab()` in `expense-monthly-tab.js`. **Note for future sessions**: this was initially wired to the *wrong* chart (the hero banner's mini sparkline) — that chart is intentionally hover-only with no click-through; the deep link belongs on the category side-panel chart only. Caught and corrected within this session.

### Resolved Known Tech Debt
- ~~`expense-core.js` length: The canvas chart library... could be split into `expense-charts.js`~~ — done, see above.

## Session: Monthly Tab Chart Polish + Cumulative Trend Line
*August 23, 2026*

Three cosmetic/functional passes on the Monthly tab, plus a small shared-engine addition.

**Bar chart color** — bars and the selected-month highlight were still blue (`#185fa5`) / navy (`#0c2340`), inconsistent with the rest of the app and barely visible on the dark theme. Switched to match the Travel tab exactly: `#3b6d11` (forest green) on light, `#20a080` (teal) on dark, read fresh on every canvas draw via a new local `_isDarkTheme()` helper (canvas colours are paint-time). The selected month is now the same hue ~30% darker, not a separate color.

**Category filter pills in dark mode** — two-part fix. First pass muted the unselected pill state (`base.css`'s `.filter-pill` is hardcoded white-bg/grey-text with no theme awareness) via a scoped `[data-theme="dark"]` override in `expense-tracker.css`. Second pass fixed a follow-up contrast issue on the *active* pill state: white text on the app's accent green/teal was hard to read on dark. Rather than hardcode a guessed shade, darkened `var(--app-accent)` in place via `color-mix()` — same technique `base.css`'s `.scroll-card.sel` already uses — so it stays legible regardless of the accent's actual value.

**Cumulative Spend / Cumulative Budget lines** — new running-total line pair on the Monthly chart's secondary right axis. Required extending `drawBarLineChart()` in `expense-core.js` with a new optional `opts.rightAxis` (own scale, own gridline-free labels via new `drawGridYRight()`, included in the shared tooltip) — purely additive, zero effect on existing callers (Dashboard sparkline, Travel hero chart). Solid purple = cumulative spend, dashed darker purple = cumulative budget; picked to stay visually distinct from the green bars and orange budget line. Simple running sum across all 12 months — months without data yet just flatline rather than projecting.

**Resolved Known Tech Debt**: none — no existing tech debt items were closed this session (the pill/chart color issues fixed here weren't previously tracked as tech debt).

**New Key Design Decision**: #16, documenting the `opts.rightAxis` pattern for future chart work.

---


## Session: Header Shell Alignment, Icon-Only Buttons, Nav Reorder & Privacy Password Gate

**What shipped:**

- **Header/year-strip/ticker/nav alignment fix.** `base.css`'s `.container` (used by `.header`) caps at 1060px while `.main` (the page content wrapper) caps at 1200px — the header, year strip, net ticker, and nav bar were all narrower and more indented than the cards below them as a result of that drift, not by design. Fixed in `expense-tracker.css`: `.header .container` bumped to 1200px, plus three new centered inner-wrapper classes (`.year-strip-inner`, `.nt-inner`, `.nav-inner`) that `index.html`'s markup now nests its content inside, while the outer bars keep their original full-bleed background/border. See new Key Design Decision #14.

- **Icon-only header-right buttons.** Theme toggle and "Load data" were pill-style (`.header-btn` — background, border, visible label). Restyled to match the existing `.privacy-btn` look via a new shared `.icon-btn` class — no background/border, just an SVG that changes colour on hover, with a `title` attribute standing in for the now-removed label. "Load data"'s old unicode-arrow text is now a proper inline SVG upload icon, bringing it in line with the app's existing icon convention. See new Key Design Decision #15.

- **Nav tab reorder.** New order: `Expense → Income → Savings → Monthly → Trend → Merchants → Travel → Insights → Budget Planner → FX`. Income/Savings moved up next to the overview tab; Insights moved to sit immediately before Budget Planner (which already depends on Insights' shared globals — Key Design Decision #13) rather than between Monthly and Trend as first proposed, so it reads as a synthesis of the explorer tabs instead of interrupting them; FX moved last, ahead of its likely eventual prune. First tab's on-screen label changed "Dashboard" → "Expense" — **label only**; internal id, panel id (`tab-dashboard`), every `switchTab('dashboard')` call, and the `_tabRenderers()` key are untouched. See new "Nav Tab Order" section.

- **Privacy password gate.** Turning Privacy mode *off* (revealing real numbers) now requires a password, entered via `base.css` §19's `.pw-*` modal (shipped fully styled, previously unwired to anything) — a wrong code shakes the input. Turning it *on* (masking) stays instant, no prompt. `togglePrivacy()` split into a thin direction-check wrapper plus `_setPrivacy(on)` (the actual state change, unchanged behaviour) and the new `_showPrivacyPasswordModal()`. The password lives in a plaintext `PRIVACY_PASSWORD` constant near the top of the Privacy Mode block in `expense-core.js` — deliberately not real security (local, single-user, offline app), just a "type the code to reveal" party trick; change it before demoing. State memory (remembering last on/off across reloads) was already in place via the existing `sa_privacy` localStorage restore and needed no changes this session.

**Files touched:** `index.html`, `expense-tracker.css`, `expense-core.js`.

**Resolved Known Tech Debt:** none — the header/`.main` width mismatch wasn't previously a tracked Known Tech Debt line item, so there's nothing to strike through there. (Parking-lot item "minor cosmetic change to the main header" removed from Phase 2 Ideas as shipped.)

## Session: Insights tab redesign, Budget Planner frequency model, Spend by Currency

Rebuilt the Insights tab from a grab-bag of mostly-unused stats into five
sections aimed at two explicit goals: optimization targets and stable
budgeting indicators.

**Kept & elevated**: Year-over-Year Growth by Category, now paired with a
Personal Inflation Index (spend-weighted total-basket CAGR) benchmarked
against Swiss CPI (`CPI_BY_YEAR`, seeded 2000–2025 from the user's own
bfs.admin.ch export). Comparisons for a partial current year truncate
every column to the same Jan–cutoff window (`_getYearScopedExpenses()`)
rather than comparing a YTD year against full prior years.

**New**: Discretionary vs. Fixed Ratio (`CATEGORY_TAGS`, keyed
Category|Sub-Category, built from the user's `Category_Master.csv`) —
lifestyle-creep tracking with an "Unclassified" safety net for anything
not in the mapping. Budget Anchors reworked to measure volatility against
a seasonal baseline (not a flat mean), with a p75 "sinking fund" figure
for volatile categories and a new Realistic Monthly Budget headline KPI.
Creeping Costs reworked to compare against the same calendar months in
prior years rather than a blanket trailing-12-month average, avoiding
false "creep" flags on naturally seasonal spend. Added a slim "Spend by
Currency" section — a money-pocket planning companion to the (unchanged)
FX tab, targeting `S.budgetPlanYear`.

**Dropped** (confirmed not actionable): Recurring/Variable donut,
per-transaction anomaly z-scores, spike months, day-of-week/day-of-month
averages, seasonal chart, month-end effect.

**Budget Planner overhaul**: each line now has a Monthly/Annual frequency
(auto-detected from history, editable), with annual lines picking a
specific month. Suggested-amount methodology replaced flat +5% with each
sub-category's own trailing CAGR (clamped), falling back to Swiss CPI,
with a p75 lean for volatile lines. Monthly distribution chart rebuilt
per-row (seasonal weights for monthly lines, exact month for annual
lines) instead of one blanket historical weighting applied to the total.
Fixed a duplicate-column bug where "3yr Avg" and "Suggested" showed the
same value. Storage migrated from a flat number per line to
`{amount, freq, month}`, with backward-compatible migration.

Established (and now documented as Key Design Decision #13) that
`expense-insights-tab.js` hosts shared stats/reference globals
(`mean`, `stddev`, `percentile`, `CPI_BY_YEAR`, `RELIABLE_COV_THRESHOLD`)
consumed by `expense-budget-tab.js` — extending the same cross-file
global-reuse pattern Merchants already used, and requiring
`expense-insights-tab.js` to load first in `index.html`.

**Open at close**: Budget Planner's new Suggested figures read as too
high on first look — not yet diagnosed, flagged to start next session on
this tab. `RELIABLE_COV_THRESHOLD` and the frequency-detection threshold
are both still unverified against real data.

### Resolved Known Tech Debt
- Insights tab's Recurring/Variable, anomaly, and calendar-pattern
  sections removed (were flagged as "usefulness TBD").
- Budget Planner's duplicate "3yr Avg"/"Suggested" table columns fixed
  to show genuinely different figures.

## Session: Income/Savings drawer column parity + Travel vendor sort

### Income/Savings drawer: column parity with Merchants

The Income/Savings drawer's modal→drawer conversion (an earlier session) moved the *container* to match Merchants but left the old six-column shape (Book Date, Amount, Category, Sub-Category, Merchant, Remark) untouched. Noticed this session that the two drawers had drifted apart in columns despite sharing identical markup/CSS — fixed by bringing Income/Savings fully in line with Merchants.

- **New column set, in order**: Date, Category, Sub-Category, Orig Amount, CHF Amount, Remarks, Notes — identical to the Merchants drawer, both in columns and left/right alignment (`.merchant-drawer-table`'s existing `white-space:nowrap` + `.notes-col` rules apply automatically; no CSS changes needed).
- **Merchant column dropped.** It's the one column Merchants doesn't have (merchant is already the row grouping there), and the brief was exact column parity — so rather than keep it as an 8th column, it was removed. Not a loss of information: the merchant is still shown in the drawer's title breadcrumb (`openFlowDrilldown(key, cat, sub, merchant, remark)`'s `merchant` arg already feeds `drawer-title`), same as before.
- **Orig Amount / CHF Amount split** replaces the old single combined Amount column, reusing the same `r._origAmount`/`r._ccy`/`r._amount` fields the Merchants and Travel drawers already read off enriched rows — this app-wide field convention made the split a direct port, not a new data lookup. Both columns respect `cfg.flipSign` (so Income still shows salary/interest as positive, same as the KPI strip and chart already do); Orig Amount carries the currency badge for non-CHF rows, same placement as Merchants.
- **Notes column is new** — reuses `getNotes()`/`_truncate()` from `expense-merchants-tab.js` (same 20-character hard truncation + `title` tooltip pattern, no new helper needed).
- **New formatter**: `_flowFmtSignedNum(v)` added alongside the existing `_flowFmtSigned(v)` — same "minus sign + `fmtNum`" shape, but for the Orig Amount column, which needs plain-number formatting (`fmtNum`) rather than the CHF-prefixed formatting (`fmtCHF`) `_flowFmtSigned` produces for the CHF Amount column.
- **Zero call-site changes**: `openFlowDrilldown()`'s signature, and both places that call it (Sources-list row click, "view all N →" breadcrumb link), are untouched — this was purely a rendering change inside the function body plus the static header markup in `ensureFlowDrawer()`.
- **Known Tech Debt update**: the "two drill-down UI shapes" item already called out that `openMerchantDrilldown()`/`openFlowDrilldown()` were "structurally near-identical modulo one column" — after this fix that's no longer even modulo one column, so collapsing them into one shared function (still not done, still not urgent) would now be a smaller change than before.

### Travel tab: vendor sort toggle

Noticed the trip drawer's Vendor accordion (`renderDrawerVendors()`) was always sorted by amount descending, with no way to see it chronologically. Added a default Date sort plus a toggle to switch to Amount.

- **Default changed to Date, not Amount.** "Date" here means each vendor's *most recent* transaction within the trip (`Math.max` over that vendor's parsed Book Date serials), sorted descending — consistent with the "most recent first" convention already used by the Merchants and Income/Savings drawers' own transaction lists. This is a per-vendor aggregate sort (vendors are groups of transactions), not a per-row sort, so "date" here answers "which vendor did I last pay" rather than reordering individual transactions.
- **New module-level state**: `_drawerVendorSort` (`'date'` | `'amount'`, defaults to `'date'`), read by `renderDrawerVendors()`'s existing `.sort()` call, which now branches on it instead of always sorting by `amount`.
- **New segmented toggle**, built dynamically via `ensureVendorSortToggle()` and inserted as a sibling **before** `#drawerVendorAccordion`, not nested inside `.drawer-section-title` — same "toggle lives below the title, never inside it" rule already documented for Monthly's and Merchants' segmented toggles (nesting risks a title-element's own button styling winning on specificity). Reuses the existing `.chart-mode-toggle`/`.toggle-btn` CSS, no new CSS added.
- **Built once, like the Merchants "Load More" button**: `ensureVendorSortToggle()` no-ops if `#vendorSortToggle` already exists in the DOM, so repeated `renderDrawerVendors()` calls (sub-category filter clicks, trip switches) don't rebind listeners — same one-time-setup convention used elsewhere in the app. Because the drawer's surrounding markup is static in `index.html` and never torn down (only shown/hidden via the `.open` class), the toggle element persists for the life of the page after first creation.
- **State is a UI preference, not filter-scoped**: `_drawerVendorSort` isn't reset when a different trip drawer opens or a Sub-Category segment is clicked — same sort mode carries over, which reads as "I prefer to browse vendors this way" rather than a per-trip setting. Flagged in case that turns out to feel wrong in practice; easy to add a reset in `openTripDrawer()` later if so.
- **No change to the per-vendor transaction table inside each accordion row** — only the vendor row order changed, not the order of transactions once a vendor is expanded. Not asked for this session.

---

## Session: Merchants sort/pagination UX + Monthly chart/table toggle

### Merchants tab: segmented sort toggle + Load More pagination

Two small UX cleanups to the filter row above the merchant list, both requested to reduce visual noise now that the row also carries the category pills, search box, and business-expense checkbox.

- **Sort control**: `renderPillFilter('merchantSort', ...)` (a 2-option pill pair) replaced with `renderMerchantSortToggle()`, a segmented control. Reuses the existing `.chart-mode-toggle`/`.toggle-btn` classes from `expense-tracker.css` — the same ones Travel's hero chart mode switch already uses — rather than introducing a new segmented-control CSS component. **Gotcha worth remembering**: this toggle must NOT live inside a `.card-title` element — `.card-title button` has higher CSS specificity than `.toggle-btn` on several shared properties (border, padding, background), so nesting it there would silently break the segmented look. This is also why Travel's own chart-mode toggle sits in its own `.hero-chart-header`, not inside `.card-title` — same reasoning applied here when the pattern got reused on Monthly (see below). This eventually became a standing convention — see the context doc's Key Design Decisions §11.
- **Pagination**: the static Top 25/50/100/All limit pills (`_merchantLimit`) are gone, replaced by progressive "Load More Merchants" pagination. `_merchantShown` starts at `MERCHANT_PAGE_SIZE` (25) and grows by 25 each click; the button is built dynamically and appended directly after `#merchantList` (same "construct once, append to DOM" approach `ensureMerchantDrawer()` already uses), so no `index.html` changes were needed for this part.
- **Auto-reset on filter change**: `_merchantShown` resets back to 25 whenever category, search, sort, year, or the business-expense toggle changes — tracked via a `filterSignature` string comparison rather than wiring a reset into every individual filter's `onChange` handler. This also covers `merchantSearch`'s input, which is wired from `index.html`, not this file, so its handler couldn't be hooked directly.
- **Old `#merchantLimit` container**: still present in `index.html` from the previous pill-filter implementation, but no longer rendered into — `renderMerchants()` now defensively clears its contents each render so no stale pills linger. Safe to remove that `<div>` from `index.html` entirely next time it's touched.

### Monthly tab: chart/table toggle + selected-month highlighting

The chart and the budget-comparison table used to be two separate stacked cards, which made the tab scroll-heavy. Merged into one card with a Chart/Table segmented toggle, and the selected-month highlight was extended to actually show up on the chart (previously only the table row changed).

- **One card, two views**: `index.html`'s two `.card`s became one, with `#monthlyChartWrap` (wrapping the existing `#monthlyChart` canvas) and `#monthlyTableWrap` (wrapping the existing `#monthlyTable`) as siblings inside it, plus a `.chart-mode-toggle`/`.toggle-btn` pair (`#monthlyViewToggle`) — same segmented-control reuse as the Merchants sort toggle above, and same reasoning for keeping it out of `.card-title`. Only one of the two containers is ever visible (`display:''`/`'none'`) at a time, tracked by module-level `_monthlyView` ('chart' | 'table', defaults to 'chart').
- **Chart only draws while visible**: `drawMonthlyChart()` (pulled out of `renderMonthly()` so the toggle handler can call it standalone) is only invoked when `_monthlyView === 'chart'`. This isn't just an optimization — `prepCanvas()` sizes the canvas's pixel buffer off its container's width, which reads as 0 while `display:none`, so drawing into a hidden container produces a corrupted low-res buffer that the browser then stretches to fill `width:100%`. **Ordering bug found and fixed this session**: the toggle's click handler originally called `drawMonthlyChart()` before `applyMonthlyView()` un-hid the container, producing exactly that stretched/blurry chart until some unrelated redraw (e.g. a category change) happened to fix it. Fixed by showing the container first (`applyMonthlyView()`), then drawing (`drawMonthlyChart()`) — showing it first forces a synchronous layout, so the width is correct by the time the canvas measures it.
- **One-time toggle wiring**: `#monthlyViewToggle`'s buttons are static markup in `index.html` (unlike the pill filters, which rebuild their own DOM each render), so `setupMonthlyViewToggle()` guards against re-binding click listeners on every `renderMonthly()` call via a `wrap.dataset.wired` flag — same one-time-setup convention used elsewhere in the app.
- **Selected-month highlight, now on both views**:
  - **Chart**: `drawBarLineChart()` (`expense-core.js`) gained an optional `opts.selectedIndex`/`opts.selectedColor` pair — purely additive, `undefined` for every other caller (Dashboard, Travel), so nothing else changes. When set, it draws a faint full-height column wash behind the selected bar, renders that bar in `selectedColor` (navy, `#0c2340`, distinct from the regular accent-blue bars) instead of `barColor`, and bolds/recolors that bar's x-axis label.
  - **Table**: the selected row's highlight was upgraded from a subtle `background:var(--surface2)` tint to `background:var(--accent-dim)` plus a left accent bar (`box-shadow:inset 3px 0 0 var(--accent)`) and accent-colored bold month text — matching the `--accent-dim` convention already used for selected sub-category rows in this same file (`_renderMonthlySubBody`).
  - `toggleMonthlyMonth()` now redraws the chart (when it's the visible view) in addition to rebuilding the table, so the highlight stays in sync regardless of which view is showing when a month is clicked.
- **Compact table**: a small CSS addition scoped to `#monthlyTableWrap.tbl-wrap thead th/tbody td/tfoot td` (tighter padding, smaller font) makes the table view read as a dense reference table rather than a full-size card table — scoped tightly so it doesn't affect any other table in the app (Merchants drawer, FX table, etc.).

---

## Session: expense-core.js / expense-merchants-tab.js cleanup

- **Fixed a real bug**: `expense-core.js` had the same tab-name→render-function map duplicated four times (tab switching, shared year strip, resize handler, `_reRenderActiveTab()`) and they'd drifted out of sync — `_reRenderActiveTab()`'s copy was missing `insights`/`budget-planner`, so toggling Privacy mode or the theme while on either of those two tabs silently failed to re-render them (stale/unmasked numbers stayed on screen). Consolidated to one `_tabRenderers()` helper function (kept as a function, not a top-level const, since it must be evaluated after the tab files' `render*()` functions have loaded) used by all four call sites.
- Extracted a small `_cssVar(name, fallback)` helper for the "read a CSS custom property, fall back if unset" pattern that was repeated inline five times across the canvas chart library (`drawGridY`, `drawBarLineChart`, `drawMultiLineChart` ×2, `drawStackedBarChart`).
- Removed two stale `// ← add this back` development comments in `startAnalysis()`.
- Removed the orphaned `remarkOverride` param from `openMerchantDrilldown()` (`expense-merchants-tab.js`), along with its year-filter-suppression branch and inline trip-tag-label regex. This param was built specifically for the Travel tab's old drill-down (before Travel got its own bespoke drawer); nothing called it any more. New signature: `openMerchantDrilldown(merchantName, categoryOverride, subOverride, monthOverride)`. If a future feature needs "scope by Remark tag, ignore shared year" again, it'll need to be re-added rather than un-commented — nothing was left in place.
- With `index.html` now reviewed: confirmed and removed `parseCSV()`/`splitCSVLine()` and the no-op `renderYearStrip()` shim from `expense-core.js` — zero references in `index.html` or any tab file.
- **Fixed the broken Insights tab**: `index.html` was missing the entire `<div id="tab-insights">` panel — the nav button and `expense-core.js`'s renderer map both expected it, but clicking Insights had nowhere to render into. Added the panel with the full set of KPI/chart/list/table containers `renderInsights()` (`expense-insights-tab.js`) needs, verified 1:1 against every `getElementById()` call in that file. Positioned in nav order, between Travel and Budget Planner.
- Confirmed `expense-category-tab.js` was never part of the codebase — the `<script>` tag was a 404 on every page load, with no matching nav button or panel. Removed the script tag.

---

## Session: Income/Savings drawer conversion + tech-debt cleanup

- `openFlowDrilldown()` (Income/Savings) converted from a centered `.modal-box` to a slide-in drawer, matching Merchants:
  - **Reused, not duplicated**: same `.drawer-overlay`/`.slide-drawer.drawer-wide` classes and open/close mechanism (`classList.add('open')`/`remove('open')`) as the Merchants drawer — no new base CSS needed.
  - **New element IDs, not reused ones**: built as `flowDrawerOverlay`/`flowDrawer` (was `flowDrilldownOverlay`), with `ensureFlowDrawer()` replacing `ensureFlowDrilldownModal()`.
  - **Function signature unchanged**: `openFlowDrilldown(key, cat, sub, merchant, remark)` and `closeFlowDrilldown()` kept their exact names and params, so the two call sites (Sources-list row click, and the "view all N →" breadcrumb link) needed no edits.
  - **Columns**: at the time of this conversion, columns were left as Book Date, Amount, Category, Sub-Category, Merchant, Remark — this pass only touched the container, not column shape. (Superseded by the column-parity fix in a later session, see above.)
  - **Header split into two lines**: the old modal had one title string; the drawer splits this into `drawer-title` (the scope breadcrumb) and a `drawer-meta` line underneath (transaction count + total), matching the Merchants/Travel drawer header shape.
  - **Zero HTML changes**: like the modal it replaces, the drawer is built dynamically via JS and appended to `<body>` once.
  - This resolved the "three drill-down UI shapes" tech-debt item down to two.
- Removed dead `.upload-zone`/`.upload-loaded` CSS block from `expense-tracker.css` (referenced `--sa-*` tokens that were never declared, so the rules were already non-functional).
- No changes needed to `expense-income-tab.js` / `expense-savings-tab.js` — both are thin config wrappers around the shared engine, so the drawer conversion was fully contained to `expense-flows-core.js`.

---

## Session: Privacy mode, dark mode fix, Merchants drawer

### Privacy mode & theme toggle

Both had CSS support in `base.css`/`expense-tracker.css` from earlier sessions but no working JS driver on the Dashboard, and coverage across the rest of the app turned out to be inconsistent. This session made both fully functional, app-wide, from a single choke point.

**Privacy mode**: `base.css` §17 ships `.privacy-btn` and `body.privacy .num-private { filter: blur(...) }`, but the JS driver for this normally lives in `utils.js` — which this app intentionally excludes. There was no button and no function.

What got implemented:
- `togglePrivacy()` in `expense-core.js` — toggles `body.classList`, persists the choice to `localStorage` (`sa_privacy`), swaps the header icon, and calls `_reRenderActiveTab()`.
- A privacy button in the header, next to the theme toggle.
- **Masking moved to the source, not CSS blur.** `fmtCHF(n)`/`fmtNum(n)` — the shared formatters almost the entire app already routes numbers through — now check `document.body.classList.contains('privacy')` and return masked strings instead of real values. Chosen over per-element `.num-private` CSS blurring because CSS filters can't touch canvas-drawn text at all (axis labels, tooltips), it covers every current and future call site automatically instead of a nine-file audit, and it's genuinely private (the real number is never in the DOM while masked).
- The `.num-private`/blur CSS convention became vestigial as a result — removed from `expense-dashboard.js` and `expense-travel-tab.js` this session (still present in `base.css` itself as harmless dead capability).
- **Known gap surfaced**: the FX tab's original-currency column doesn't go through `fmtCHF`/`fmtNum`, so it's the one place Privacy mode doesn't mask. Deprioritized — that tab's usefulness is still TBD.

**Theme toggle**: was already partly working (`toggleTheme()` existed, canvas colours redrew on switch) but had a real bug: `expense-tracker.css`'s `[data-theme="dark"]` block redefined `--bg`/`--surface`/`--text`/etc. but never redefined `--white`, `--muted`, or `--faint` — three `base.css` §1 tokens that several shared components hardcode directly (`.card-hero`, `.kpi-tile`, `.modal-box`, `.pw-modal`, `.data-table`'s sticky first column). This is what broke the Dashboard's hero card specifically (built on `base.css`'s `.card-hero`, which hardcodes `background: var(--white)`). Fixed by adding `--white`/`--muted`/`--faint` to the dark block, mapped onto the same dark surface/text scale already used elsewhere in it.

**Shared re-render helper**: both toggles needed the active tab's charts/content redrawn on switch. Consolidated into one `_reRenderActiveTab()` in `expense-core.js`, which looks up the active `.tab-panel` and calls that tab's render function from a small lookup map.

**Icon convention**: replaced emoji icons (🌙/☀️, 👁/🙈) with inline SVG line icons (moon/sun, eye/eye-off) using `stroke="currentColor"`, for visual consistency and to stay fully offline (no external icon library — the app loads no external resources beyond its two local stylesheets and local scripts).

**Header cleanup**: removed the `#dataStatus` badge (transaction-count/date-range text) and its backing `updateDataStatus()` function/call. Header right-side is now: privacy toggle → theme toggle → "⬆ Load data" link.

### Merchants tab drill-down: modal → drawer

Converted `openMerchantDrilldown()` from a centered `.modal-box` to a slide-in drawer, matching the Travel tab's existing pattern, and added three new columns.

- **Reused, not duplicated**: the drawer uses the exact `.drawer-overlay`/`.slide-drawer` classes and open/close animation that `expense-tracker.css` already defines for the Travel tab.
- **Width variant, not a base-class change**: the Merchants drawer needs to fit 7 columns on one line, wider than Travel's 4-column drawer needs. Added a `.drawer-wide` modifier class (`width:920px; max-width:95vw`) applied only to the Merchants drawer, rather than widening `.slide-drawer` itself (which would have widened Travel's drawer unnecessarily).
  - **Specificity gotcha**: `.slide-drawer.open` and `.slide-drawer.drawer-wide` have equal specificity (two classes each), so a naive `.drawer-wide { right: -920px }` rule could lose to `.open`'s `right:0` or vice versa depending on stylesheet order. Added an explicit `.slide-drawer.drawer-wide.open { right: 0 }` (three classes → higher specificity) so the open state always wins regardless of source order. Any future width/position variant on a shared open/close class pair should follow the same three-class-override pattern.
- **Built dynamically, like the modal it replaced** — `ensureMerchantDrawer()` (renamed from `ensureMerchantDrilldownModal()`) still constructs the drawer via JS and appends it to `<body>` once.
- **Columns extended**: was Book Date / Amount / Category / Sub-Category / Remark; became Date / Category / Sub-Category / Orig Amount / CHF Amount / Remarks / Notes (reordered, plus two new columns). Orig Amount carries the currency badge for non-CHF rows (moved from the old combined Amount column). Notes is new — `getNotes(row)` reads the `Notes` field (same field the Travel tab's transaction table already reads), hard-truncated to 20 characters via a new `_truncate()` helper, with the untruncated text available on hover via `title`.
- **No wrap on the first six columns**: sized to fit on one line at the drawer's 920px width for typical data. Very long Remarks text isn't capped (only Notes has an explicit character limit).
- **Zero changes needed at any call site**: `openMerchantDrilldown()`/`closeMerchantDrilldown()` kept their exact names and parameter signatures, so the Dashboard's merchant panel and the Monthly tab's month drill-down picked up the new drawer automatically.

---

## Session: Travel UX overhaul

- Travel tab restructured: KPI strip + trend chart merged into a single Executive Summary hero banner with a click-through yearly→monthly trend; the old inline per-trip accordion + shared modal replaced with a slide-in drawer (proportional Sub-Category bar → filtered Vendor accordion → inline transaction tables, no modal).
- Trip list gained a three-way sort toggle (Date / Amount / Name) alongside the existing search box.
- Hero chart bar click now correctly drives the shared year strip (`onSharedYearSelect()`) — was calling a nonexistent function.

---

## Session: Monthly drill-down

- Monthly tab month drill-down (Category→Sub-Category accordion + merchant list, scoped per month).
- `openMerchantDrilldown()` extended with an optional `monthOverride` param.
- `drawBarLineChart()` extended with an optional `opts.onBarClick(index)` hook.
- Dashboard deep-links to Monthly and Merchants tabs, plus the span+sibling pattern for mixing JS-managed text with static controls in a title (now Key Design Decision §9).
- Income/Savings two-column layout fixed to match Dashboard/Monthly's equal-height convention (now Key Design Decision §10).

---

## Session: Income & Savings tabs (Phase 2 build)

Built as two separate nav tabs sharing one engine (`expense-flows-core.js`). Net Cash Flow KPI tile also shipped on the Dashboard.

---

## Resolved Known Tech Debt

Items that were once open, now fixed — kept here for history; the active context doc's Known Tech Debt section no longer lists these.

- ~~**Dead CSS in `expense-tracker.css`**: `.upload-zone`, `.upload-loaded` and related rules reference `--sa-*` CSS variables that no longer exist.~~ **Removed** — confirmed unused (header is just a plain "Load data" link, not a drag-drop zone) and the `--sa-*` tokens were never declared anywhere.
- ~~**`remarkOverride` on `openMerchantDrilldown()` is orphaned**: built specifically for the Travel tab's old trip drill-down.~~ **Removed** — nothing called it, so the param, its year-filter-suppression branch, and its inline trip-tag-label regex were all deleted. Signature is now `openMerchantDrilldown(merchantName, categoryOverride, subOverride, monthOverride)`.
- ~~**`parseCSV()`/`splitCSVLine()` in `expense-core.js` appear unused**~~ **Confirmed and removed** — `index.html` has no reference to either; the data path is JSON-only (Spend Loader → `actuals.json`).
- ~~**`renderYearStrip()` in `expense-core.js` is a no-op "legacy shim"**~~ **Confirmed and removed** — zero references anywhere in `index.html`.
- ~~**`expense-category-tab.js` is loaded in `index.html` but appears to be dead weight**~~ **Confirmed and removed** — the file never existed in the codebase at all; the `<script>` tag was a 404 on every page load.
- ~~**The "Insights" nav tab has no matching panel markup**~~ **Fixed** — added the missing `<div class="tab-panel" id="tab-insights">` to `index.html`, verified 1:1 against every `getElementById()` call in `expense-insights-tab.js`.
- ~~**Trip tag parsing duplicated as a small inline regex in `expense-merchants-tab.js`'s drawer**~~ **Removed** along with the orphaned `remarkOverride` path — now only one copy, in `expense-travel-tab.js` (`parseTripTag()`/`tripDisplayName()`).
- ~~**`#merchantLimit` container in `index.html` is dead markup**~~ superseded by Load More pagination; `renderMerchants()` defensively clears it each render. (The `<div>` itself was left in `index.html` — safe to delete next time that file is touched, but not itself blocking anything.)
- ~~**Two drill-down UI shapes coexisted (down from three)**: Merchants/Dashboard/Monthly/Income/Savings flat-table drawers vs. Travel's bespoke drawer~~ — reduced from three to two shapes when Income/Savings converted from modal to drawer, then the remaining two flat-table drawers reached full column parity in a later session (see above). The Travel-vs-flat-table distinction remains open by design (see active Known Tech Debt).
