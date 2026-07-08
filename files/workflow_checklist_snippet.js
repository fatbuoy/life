/**
 * HORIZON — Monthly Workflow Checklist
 * Add to assumptions.js (or a new section of the Assumptions tab).
 *
 * Renders a persistent checklist of data maintenance tasks.
 * State stored in a JS object keyed by YYYY-MM so each month starts fresh.
 * Persisted to a local file via download-and-replace (same pattern as snapshots).
 *
 * HOW TO INTEGRATE:
 * 1. Add <div id="workflowPanel"></div> inside the Assumptions tab HTML.
 * 2. Call renderWorkflowChecklist() from renderAssumptions() or renderAll().
 * 3. Add the CSS block below to wealth.css.
 * 4. Include the staleness helper getStalenessInfo() in core.js (see bottom).
 */

/* ─── CHECKLIST DEFINITION ──────────────────────────────────────── */

const WORKFLOW_TASKS = [
  // Monthly
  { id: 'snap_entry',    freq: 'monthly',   label: 'Enter net worth snapshots',       detail: 'All accounts → Net Worth tab → 📷 Capture Snapshot. Run convert_snapshots.py after any CSV import.' },
  { id: 'fx_update',     freq: 'monthly',   label: 'Update FX rates',                 detail: 'Edit assumptions.json → fx section. EUR/CHF, GBP/CHF, USD/CHF, INR/CHF. Use ECB or xe.com mid-rates.' },
  { id: 'expenses_sync', freq: 'monthly',   label: 'Sync budget tracker expenses',    detail: 'Export year-to-date from budget-tracker.html, update expenses_summary.json totals for current year.' },

  // Quarterly
  { id: 'scenario_review', freq: 'quarterly', label: 'Review Scenarios tab',          detail: 'Check runway age vs. plan. Does base case still show portfolio surviving to 90? Any drift vs. last quarter?' },
  { id: 'liquidity_rag',   freq: 'quarterly', label: 'Check Liquidity RAG status',    detail: 'Liquidity tab → contingency triggers. Green = no action. Amber = review spend. Red = convene decision.' },
  { id: 'pillar3_contrib', freq: 'quarterly', label: 'Confirm Pillar 3a contribution', detail: 'Verify CHF 7,258 (2026 max) contributed for the year. Update income.json if changed.' },

  // Annually
  { id: 'income_update',   freq: 'annual',  label: 'Update income.json',              detail: 'Salary (incl. any raise), rental net income (costs change), pension estimates if new data available.' },
  { id: 'pension_verify',  freq: 'annual',  label: 'Verify state pension records',    detail: 'gov.uk/check-national-insurance-record (both). MyWelfare.ie (both). Ausgleichskasse (wife non-employed yrs).' },
  { id: 'assumptions_rev', freq: 'annual',  label: 'Full assumptions review',         detail: 'Inflation rates, real return assumption, tax rate (get updated Zurich canton figure from advisor), contingency thresholds.' },
  { id: 'scenario_annual', freq: 'annual',  label: 'Annual scenario comparison',      detail: 'Run base / optimistic / pessimistic side-by-side. Save named scenarios with date stamp. Compare to prior year.' },
  { id: 'tax_return',      freq: 'annual',  label: 'File Swiss tax return',           detail: 'Update ch_income_tax_rate in assumptions.json after seeing actual Zurich tax bill.' },

  // Ad hoc
  { id: 'nic_payment',     freq: 'adhoc',   label: 'Pay Class 3 NICs (URGENT)',       detail: 'HMRC offered 2019–2026 gap years. Both Me and Wife. Deadline may apply — check gov.uk immediately.' },
  { id: 'property_val',    freq: 'adhoc',   label: 'Update property valuation',       detail: 'When Chislehurst BR7 property is revalued or mortgage changes, update acc_property_uk snapshot + rental income.' },
  { id: 'pillar2_decision',freq: 'adhoc',   label: 'Pillar 2 lump sum vs. annuity decision', detail: 'Model both in Scenarios tab before retirement date. Consider tax year spreading. Deadline = retirement minus ~3 months.' },
];

const FREQ_ORDER = { monthly: 0, quarterly: 1, annual: 2, adhoc: 3 };
const FREQ_LABELS = { monthly: '📅 Monthly', quarterly: '🗓 Quarterly', annual: '📆 Annually', adhoc: '⚡ Ad hoc' };
const FREQ_COLORS = { monthly: 'var(--app-accent)', quarterly: 'var(--c-teal)', annual: 'var(--c-purple)', adhoc: 'var(--c-warning)' };

/* ─── STATE ─────────────────────────────────────────────────────── */

let _wfState = {}; // { 'YYYY-MM': { taskId: true/false } }

function _wfKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function _wfGet(id) {
  return !!(_wfState[_wfKey()] && _wfState[_wfKey()][id]);
}

function wfToggle(id) {
  const k = _wfKey();
  if (!_wfState[k]) _wfState[k] = {};
  _wfState[k][id] = !_wfState[k][id];
  renderWorkflowChecklist();
  // Persist state as a downloadable JSON so it survives page refresh
  // (same download-and-replace pattern used for snapshots)
  _wfPersist();
}

function _wfPersist() {
  const blob = new Blob([JSON.stringify(_wfState, null, 2)], { type: 'application/json' });
  // Auto-save: silently update a hidden <a> the user can use to export
  const existing = document.getElementById('wfExportLink');
  if (existing) existing.href = URL.createObjectURL(blob);
}

function wfExport() {
  const blob = new Blob([JSON.stringify(_wfState, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workflow_state.json`;
  a.click();
}

function wfImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      _wfState = JSON.parse(e.target.result);
      renderWorkflowChecklist();
    } catch(err) { alert('Could not parse workflow_state.json'); }
  };
  reader.readAsText(file);
}

/* ─── RENDER ────────────────────────────────────────────────────── */

function renderWorkflowChecklist() {
  const el = document.getElementById('workflowPanel');
  if (!el) return;

  // Staleness banner
  const stale = typeof getStalenessInfo === 'function' ? getStalenessInfo() : null;
  const stalenessHtml = stale ? `
    <div class="notice ${stale.level === 'red' ? 'notice-danger' : stale.level === 'amber' ? 'notice-warning' : 'notice-success'}" style="margin-bottom:12px">
      <div class="notice-title">${stale.level === 'green' ? '✅ Data current' : stale.level === 'amber' ? '⚠️ Snapshots aging' : '🔴 Snapshots overdue'}</div>
      <div class="notice-body">Last snapshot: <strong>${stale.label}</strong> — ${stale.days} days ago.${stale.level !== 'green' ? ' Enter a new snapshot in the Net Worth tab.' : ''}</div>
    </div>` : '';

  // Group tasks by frequency
  const groups = ['monthly','quarterly','annual','adhoc'];
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Completion counts
  const key = _wfKey();
  const doneCount = WORKFLOW_TASKS.filter(t => _wfGet(t.id)).length;
  const totalCount = WORKFLOW_TASKS.length;
  const pct = Math.round(doneCount / totalCount * 100);

  let html = `
    <div class="card-hero" style="margin-bottom:14px">
      <div class="hero-strip">
        <div class="hs-left">
          <div class="hs-title">📋 Monthly Workflow</div>
          <div class="hs-sub">${monthLabel} · ${doneCount} of ${totalCount} tasks</div>
        </div>
        <div class="hs-right">
          <div class="hs-stat">${pct}%</div>
          <div class="hs-lbl">complete</div>
        </div>
      </div>
      <div style="height:6px;background:rgba(255,255,255,.15)">
        <div style="height:100%;width:${pct}%;background:var(--c-success);transition:width .3s"></div>
      </div>
    </div>

    ${stalenessHtml}

    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <label class="btn btn-secondary" style="cursor:pointer;font-size:11px">
        📂 Load state <input type="file" accept=".json" onchange="wfImport(this)" style="display:none">
      </label>
      <button class="btn btn-secondary" style="font-size:11px" onclick="wfExport()">💾 Save state</button>
      <button class="btn btn-secondary" style="font-size:11px" onclick="wfResetMonth()" title="Clear this month's completions">↺ Reset month</button>
    </div>`;

  groups.forEach(freq => {
    const tasks = WORKFLOW_TASKS.filter(t => t.freq === freq);
    const freqDone = tasks.filter(t => _wfGet(t.id)).length;
    html += `
      <div class="wf-group" style="margin-bottom:16px">
        <div class="sec-lbl" style="color:${FREQ_COLORS[freq]}">${FREQ_LABELS[freq]} · ${freqDone}/${tasks.length}</div>`;

    tasks.forEach(task => {
      const done = _wfGet(task.id);
      html += `
        <div class="wf-row ${done ? 'wf-done' : ''}" onclick="wfToggle('${task.id}')">
          <div class="wf-check">${done ? '✅' : '⬜'}</div>
          <div class="wf-content">
            <div class="wf-label">${task.label}</div>
            <div class="wf-detail">${task.detail}</div>
          </div>
        </div>`;
    });

    html += `</div>`;
  });

  html += `
    <div class="notice notice-info" style="margin-top:8px">
      <div class="notice-title">How to use</div>
      <div class="notice-body">Tick tasks as you complete them. Save state to <code>workflow_state.json</code> in the <code>live/wealth/</code> folder. Load it on your next session. Monthly tasks reset each calendar month — quarterly/annual/ad hoc tasks carry over until you clear them.</div>
    </div>`;

  el.innerHTML = html;
}

function wfResetMonth() {
  if (!confirm('Clear all completions for this month?')) return;
  delete _wfState[_wfKey()];
  renderWorkflowChecklist();
}

/* ─── LOAD STATE ON INIT ────────────────────────────────────────── */
// Call this from loadData() or renderAll() in core.js, after data is loaded.
// If workflow_state.json exists in the folder, load it first:
//
// async function loadWorkflowState() {
//   try {
//     const r = await fetch('./workflow_state.json');
//     if (r.ok) _wfState = await r.json();
//   } catch(e) { /* file doesn't exist yet — start fresh */ }
// }


/* ─── ADD TO core.js ────────────────────────────────────────────── */
// Paste this function into core.js (after loadData):
//
// function getStalenessInfo() {
//   if (!D.snapshots || !D.snapshots.length) return { days: null, label: 'No snapshots', level: 'red' };
//   const dates = D.snapshots.map(s => s.date).filter(Boolean).sort();
//   const latest = dates[dates.length - 1];
//   const days = Math.floor((Date.now() - new Date(latest)) / 86400000);
//   const label = new Date(latest).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
//   const level = days <= 45 ? 'green' : days <= 90 ? 'amber' : 'red';
//   return { days, label, level };
// }


/* ─── ADD TO assumptions tab HTML (index.html) ──────────────────── */
// Inside the #tab-assumptions tab panel, add:
//
// <div id="workflowPanel"></div>
//
// And call renderWorkflowChecklist() from renderAssumptions().
