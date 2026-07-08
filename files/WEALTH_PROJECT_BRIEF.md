# Sahani Suite — Horizon (LIVE/Wealth Module)
## Project Brief — V1 Complete

> Drop this file into a new Claude Project alongside `base.css` and `utils.js`.  
> It gives full context to continue building without needing prior conversation history.

---

## Who this is for

A 47-year-old (**Me**, born 1977) and his wife (born 1980, 3 years younger), living permanently in Switzerland. No children. No estate-building intent — the goal is to retire as early as possible (~age 50) and spend down to a comfortable zero. A financial advisor liquidity plan already exists; this app supports monitoring and contingency decisions.

---

## What the app is — and is not

**Is:** A private, local-only finance planning app. Never published. Never synced to GitHub. Sits in `live/wealth/`. Uses dummy/placeholder numbers in all schemas — real figures are populated locally and never pasted into any AI chat.

**Is not:** A daily transaction tracker (that's `budget-tracker.html`). Not a bank integration. Not on GitHub Pages.

---

## Technical constraints

- **No frameworks.** Plain HTML, CSS, JS only.
- **Offline-capable.** All data in local JSON files. No external API calls at runtime.
- **Stack:** Chart.js 4.4.1 (cdnjs), Python HTTP server (local), shared `base.css` + `utils.js`.
- **No GitHub sync** for this module (excluded via `.gitignore`).
- **Sahani Suite conventions:** Two-layer CSS token system, `ios-*` modals for all forms, `base.css`/`utils.js` checked before any new code.

---

## File structure

```
live/wealth/
├── index.html          — HTML skeleton (~370 lines). Edit for tab HTML.
├── wealth.css          — Horizon-specific styles.
├── scenarios.json      — Saved named scenarios.
├── convert_snapshots.py — CSV → snapshots.json import tool.
├── js/
│   ├── core.js         — Global D state, loadData, renderAll, FX helpers (toCHF, chfToDisplay),
│   │                     setCurrency, fmt, fmtD, displaySymbol, showTT, hideTT.
│   ├── networth.js     — Net Worth tab + snapshot modal + drill-down modal.
│   ├── cashflow.js     — Cash Flow tab.
│   ├── timeline.js     — Retirement Timeline tab.
│   ├── liquidity.js    — Liquidity/Runway tab.
│   ├── assumptions.js  — Assumptions tab (editable form + monthly workflow checklist).
│   └── scenarios.js    — Scenarios engine (~400 lines, models 2026–2090).
└── data/               — ALL LOCAL ONLY, never commit real figures
    ├── assumptions.json
    ├── accounts.json   — 26 accounts incl. inactive.
    ├── holdings.json   — Asset class definitions + allocation targets. Liability flag lives HERE.
    ├── income.json     — Split arrays: salary[], rental[], statePensions[], privatePensions[].
    ├── expenses_summary.json — Annual totals by category (string-keyed years object).
    └── snapshots.json  — Per-account monthly snapshots. Source of truth for current values.
```

**JS load order:** `utils.js` → `core.js` → `networth.js` → `cashflow.js` → `timeline.js` → `liquidity.js` → `assumptions.js` → `scenarios.js`

---

## Data architecture — key rules

| Rule | Detail |
|------|--------|
| Snapshots = source of truth | Current account values come from snapshots, not holdings.json |
| holdings.json = schema only | Provides asset class definitions and allocation targets as defaults |
| FX at render time | `totalCHF` computed at render from per-snapshot FX rates — not stored |
| Liability flag | On `holdings.json` entries — modal functions reading from accounts.json will miss it |
| INR FX | Source CSV stores CHF-per-INR; `convert_snapshots.py` inverts to INR-per-CHF for storage |

---

## Global state and key helpers

| Symbol | Description |
|--------|-------------|
| `D` | Global data object: `D.accounts`, `D.holdings`, `D.snapshots`, `D.income`, `D.expenses`, `D.assumptions` |
| `toCHF(amount, currency, snap?)` | Convert any currency to CHF using snapshot or assumption FX |
| `chfToDisplay(chf)` | Convert CHF to currently selected display currency |
| `fmt(n)` / `fmtD(n)` | Format numbers (CHF / display currency) |
| `displaySymbol()` | Returns current currency symbol |
| `showTT(e, title, rows)` / `hideTT()` | Shared tooltip |

---

## V1 complete — tab-by-tab status

### Net Worth ✅
- Total view by asset type (collapsible groups, expand-all toggle)
- Hero KPI strip with currency switcher (CHF/EUR/GBP/USD/INR)
- Horizontal allocation bars: asset type + currency exposure
- Click-to-scroll on hero bars
- 9-year trend chart (currency-switchable), drill-down modal per asset type
- Drill-down: multi-series per-account lines + CAGR + yearly averages + interactive legend
- Snapshot capture modal: grouped by asset type, liability handling, embedded FX fields
- Linear interpolation engine (`buildInterpolatedMatrix`) — fills sparse data, no extrapolation beyond account lifetime

### Cash Flow ✅
- Hero strip with year switcher (`_cfYear` state), defaults to most recent complete year
- Income/expense breakdown by category
- Net savings, savings rate, retirement target comparison

### Retirement Timeline ✅
- Stacked bar waterfall (Chart.js), one bar per year from retirement through planning horizon
- All income streams (salary, rental, 6 pension streams) with triple-lock growth
- Portfolio drawdown fills gap vs. target spend
- Pillar 2 mode (lumpsum vs. annuity) notice toggle

### Liquidity & Runway ✅
- Hero KPI strip
- Contingency triggers panel (green/amber/red tiers)
- Dual-line canvas drawdown chart (flat vs. real return)
- Year-by-year drawdown table
- Gap income sources summary card
- `firstPensionAge` correctly reads `ahv_me_age` (65) — NOT `ahv_wife_age`

### Scenarios ✅ (`scenarios.js` ~400 lines)
- Full engine models years 2026–2090
- Salary, rental, 6 pension streams with triple-lock growth, Pillar 2 (lump sum/annuity), Pillar 3a drawdown
- Two-phase expense inflation (CH CPI working years → configurable lower rate in retirement)
- Flat-rate tax, contingency status per row
- Named scenario saves + live scratch pad
- Side-by-side comparison of up to 3 scenarios
- Sequence-of-returns modeling (GFC 2008, dot-com presets + custom slider)
- Anchor metrics: runway age, portfolio balance at age 90

### Assumptions ✅ (basic) / 🔲 (editable form — V1 gap, see below)
- Displays current assumption values from `assumptions.json`
- Monthly workflow checklist (see below)
- **Gap:** FX rates and return assumptions still require manual JSON editing to change

---

## Known bugs — all resolved

| Bug | Fix |
|-----|-----|
| Chart.js + Safari blank render | Use `setTimeout(fn, 0)` not `requestAnimationFrame` |
| Safari `display:none` toggle silently ignored | Always toggle a wrapper div, never individual elements with inline `display:none` set in HTML |
| `str_replace` leaving orphaned code | Validate JS after every edit: `node -e "new Function(require('fs').readFileSync('js/X.js','utf8'))"` — no output = valid |
| Liability flag missed by modal | Flag lives on `holdings.json` entries, not `accounts.json` |
| INR FX inverted | `convert_snapshots.py` handles inversion from source CSV |
| `firstPensionAge` bug in Liquidity tab | Now correctly reads `ahv_me_age` (65), producing correct 15-year bridge gap |

---

## Income data (pre-calculated defaults — populate actuals locally)

### Me
| System | Amount | Starts | Currency |
|--------|--------|--------|----------|
| Swiss AHV | CHF 14,885/yr | Age 65 (2043) | CHF |
| Irish State Pension | €8,200/yr | Age 66 (2044) | EUR |
| UK State Pension | £4,108/yr | Age 68 (2046) | GBP |

### Wife
| System | Amount | Starts | Currency |
|--------|--------|--------|----------|
| Swiss AHV | CHF 11,167/yr | Age 64 (2046) | CHF |
| Irish State Pension | €8,200/yr | Age 66 (2047) | EUR |
| UK State Pension | £3,744/yr | Age 68 (2049) | GBP |

**Combined steady-state from ~age 71:** ~CHF 50,990/yr (today's money, pre-tax)

---

## Key planning parameters

| Parameter | Value |
|-----------|-------|
| Target retirement age (Me) | 50 |
| Bridge gap | Age 50–65 (15 years from portfolio only) |
| Steady-state pension floor | ~CHF 51,000/yr from age 71 |
| Swiss income tax | ~22% (Zurich canton estimate) |
| Withdrawal rate assumption | 3.5% |
| Planning horizon | Age 90 |
| Estate target | Zero (intentional spend-down) |

---

## Pending actions — financial (outside the app)

- [ ] **URGENT:** Pay Class 3 NICs for both — HMRC offered 2019–2026 gap years
- [ ] Verify Me NI record: gov.uk/check-national-insurance-record  
- [ ] Verify Wife NI record: gov.uk/check-national-insurance-record
- [ ] Verify Me PRSI record: MyWelfare.ie
- [ ] Verify Wife PRSI record: MyWelfare.ie
- [ ] Enquire with Ausgleichskasse: wife's non-employed AHV years from 2024

---

## V1 gaps — do before calling this done

These are not enhancements — they complete the original intent:

### 1. Assumptions tab — editable form 🔲
Currently displays values but requires manual JSON editing to change anything. Target: an `ios-*` style form in the Assumptions tab that writes back to `assumptions.json` via a download-and-replace workflow (same pattern as snapshot capture). Fields: FX rates, return assumptions, inflation rates, contingency thresholds.

**Session brief:** Paste `assumptions.js` + `assumptions.json`. Ask Claude to add an edit modal per section (FX / Returns / Inflation / Contingency) using the existing ios-* pattern. Output = updated `assumptions.js` only.

### 2. Data staleness indicator 🔲
A lightweight "last snapshot: N days ago" warning surfaced in the Net Worth hero strip and/or Assumptions tab. Without it, data drift is invisible. Logic: find max `date` across all snapshots, compute days since today, show amber pill if >45 days, red if >90 days.

**Session brief:** Paste `core.js` + `networth.js`. One-function addition to `core.js` (`getSnapshotAge()`), one pill render in the Net Worth hero strip `hs-right` block.

---

## V2 enhancement backlog

### Net Worth
- Dynamic asset-type limits based on future liquidity requirements (3 years expenses as cash, glide-path maturity dates)
- CAGR view to support asset conversion decisions (which to liquidate, which to keep)
- Actual 3-year portfolio CAGR feeding Scenarios tab as a dynamic input
- Data contract / KPI feed to EAT > RUN > LIVE homepage (RAG signal + net worth headline)

### Cash Flow
- Floor/recurring vs. discretionary expense breakdown (feeds Scenarios planning)

### Retirement Timeline
- Actionable liquidation sequencing: which accounts to draw from in which order for tax efficiency
- Pillar 2 lump sum timing optimisation (tax-year spreading)

### Liquidity
- RAG signal data contract → homepage widget

### Scenarios
- Dynamic portfolio performance input from actual snapshot CAGR (replace fixed return assumption)
- Dynamic property valuation from snapshot data

### Assumptions
- Auto-update FX rates from latest snapshots (instead of manual entry)

---

## Monthly workflow (see Assumptions tab checklist in-app)

The Assumptions tab includes a rendered monthly checklist. See `assumptions.js` → `renderWorkflowChecklist()`. Core cadence:

| Frequency | Task |
|-----------|------|
| Monthly | Enter new net worth snapshot for all accounts |
| Monthly | Update FX rates in assumptions.json |
| Monthly | Export budget tracker year-to-date, update expenses_summary.json |
| Quarterly | Review Scenarios tab — check runway age vs. plan |
| Quarterly | Review Liquidity RAG status |
| Annually | Update income.json: salary, pension estimates, rental net |
| Annually | Verify state pension records (gov.uk, MyWelfare.ie, Ausgleichskasse) |
| Annually | Review and update Assumptions (inflation, return rates, tax estimate) |
| Annually | Full scenario comparison: base vs. optimistic vs. pessimistic |
| Ad hoc | Run convert_snapshots.py after any bulk CSV import |

---

## Working with Claude in future sessions

- Paste `core.js` + the relevant tab JS. Do not paste all files.
- `base.css` and `utils.js` are in the Project — never paste them.
- Validate JS after every edit: `node -e "new Function(require('fs').readFileSync('js/X.js','utf8'))"` (no output = valid)
- Surgical edits only — specify changed sections, not full file rewrites.
- One deliverable per session. Don't carry unrelated tab work across sessions.
- Update this brief at the end of sessions where architecture or schemas changed.

## Files to keep in this Claude Project

| File | Why |
|------|-----|
| `WEALTH_PROJECT_BRIEF.md` | This file — always current |
| `base.css` | Checked before any CSS/component work |
| `utils.js` | Checked before any utility/helper work |
| `assumptions.json` | Schema reference (dummy data only) |
| `income.json` | Schema reference — income stream structure |
| `expenses_summary.json` | Schema reference — expense category structure |

**Do NOT upload to this Project:** `snapshots.json`, `accounts.json`, `holdings.json`, `scenarios.json` — these contain or will contain real financial data.
