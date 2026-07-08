'use strict';

/* ══════════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════════ */
const S = {
  actuals: [],
  budget: [],
  years: [],
  selectedYear: null,
  fxSelectedYear: null,
  merchantSelectedYear: null,
  dashSelectedYear: null,
  monthlySelectedYear: null,
  insightsSelectedYear: null,
  hiddenSeries: new Set(),
  budgetPlan: {},        // { 'Category||Sub-Category': amount }
  budgetPlanYear: null,
};

const CCY_COLORS = {
  CHF:'#ef9f27', EUR:'#185fa5', GBP:'#3b6d11', USD:'#20a080', INR:'#7f77dd'
};
const CAT_COLORS = [
  '#185fa5','#3b6d11','#c0392b','#ef9f27','#7f77dd','#20a080',
  '#d08030','#b55fa0','#0e7a6a','#5548b0','#0e6088','#6b8c3a',
];

/* ══════════════════════════════════════════════════════════════════
   PARSE CSV  (kept for any future inline use; not called on boot)
══════════════════════════════════════════════════════════════════ */
function parseCSV(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.trim().split('\n');
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = splitCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] !== undefined ? vals[idx].trim() : ''; });
    rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

function serialToDate(serial) {
  const d = new Date((serial - 25569) * 86400000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function enrichRow(row) {
  const serial = parseFloat(row['Book Date']);
  if (!isNaN(serial) && serial > 0) {
    const dt = serialToDate(serial);
    row._year = dt.year; row._month = dt.month;
  } else {
    row._year = 0; row._month = 0;
  }
  row._amount     = parseFloat(row['Amount']) || 0;
  row._origAmount = parseFloat(row[' Orig Ccy '] || row['Orig Ccy'] || 0);
  row._fx         = parseFloat(row['FX']) || 1;
  row._group      = (row['Group'] || '').trim();
  row._category   = (row['Category'] || '').trim();
  row._subcat     = (row['Sub-Category'] || '').trim();
  row._ccy        = (row['Ccy'] || 'CHF').trim();
  row._source     = (row['Source'] || '').trim();
  const canonical = (row['Canonical Merchant'] || '').trim();
  const raw       = (row['Recipient / Order issuer'] || '').trim();
  row._merchant    = canonical || raw;
  row._merchantRaw = raw;
  return row;
}

/* ══════════════════════════════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════════════════════════════ */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = isDark ? '🌘' : '🌖';
  localStorage.setItem('sa_theme', isDark ? 'light' : 'dark');
  // Redraw active chart (canvas colours are paint-time)
  const active = document.querySelector('.tab-panel.active');
  if (active) {
    const id = active.id.replace('tab-', '');
    const r = { dashboard:renderDashboard, monthly:renderMonthly, 
                 trend:renderTrend, fx:renderFX, merchants:renderMerchants };
    if (r[id]) r[id]();
  }
}
// Restore saved theme preference
(function() {
  const saved = localStorage.getItem('sa_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
  }
})();

/* ══════════════════════════════════════════════════════════════════
   JSON DATA LAYER  (replaces IndexedDB)
   Expects two files relative to the app:
     data/actuals.json   — array of enriched row objects
     data/budget.json    — array of enriched budget row objects
══════════════════════════════════════════════════════════════════ */

/**
 * Path config — adjust if your data folder lives elsewhere.
 * Using relative paths means this works on any local server.
 */
const DATA_PATHS = {
  actuals: 'data/actuals.json',
  budget:  'data/budget.json',
};

/**
 * Load a JSON data file.
 * Returns [] on any failure (missing file is not an error for budget).
 */
async function loadJSON(path, required = true) {
  try {
    const res = await fetch(path);
    if (!res.ok) {
      if (!required) return [];
      throw new Error(`HTTP ${res.status} loading ${path}`);
    }
    return await res.json();
  } catch (err) {
    if (!required) return [];
    throw err;
  }
}

/* ── Boot: fetch JSON files on startup ─────────────────────────── */
(async function bootFromJSON() {
  showBootStatus('Loading data…');
  try {
    // Rows from the Loader already have _year, _month etc. enriched.
    // We re-enrich defensively in case the JSON was exported without them,
    // or to handle legacy files produced by earlier IndexedDB exports.
    const [rawActuals, rawBudget] = await Promise.all([
      loadJSON(DATA_PATHS.actuals, true),
      loadJSON(DATA_PATHS.budget,  false),
    ]);

    S.actuals = rawActuals.map(r => r._year !== undefined ? r : enrichRow(r));
    S.budget  = rawBudget.map(r  => r._year !== undefined ? r : enrichRow(r));

    updateDataStatus();

    if (S.actuals.length) {
      hideBootStatus();
      startAnalysis();
    } else {
      showBootStatus('No actuals data found. Use Spend Loader to create data/actuals.json.', true);
    }
  } catch (err) {
    showBootStatus(
      `Could not load data: ${err.message}. ` +
      `Run the app from a local server (not file://) and check that data/actuals.json exists.`,
      true
    );
    console.error('Boot failed:', err);
  }
})();

function showBootStatus(msg, isError = false) {
  let el = document.getElementById('bootStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bootStatus';
    el.style.cssText = [
      'max-width:480px','margin:60px auto','padding:20px 24px',
      'border-radius:10px','font-size:13px','line-height:1.6',
      'text-align:center','font-family:inherit',
    ].join(';');
    document.querySelector('main').prepend(el);
  }
  el.style.background = isError ? '#fef2f2'   : '#f0fdf4';
  el.style.color      = isError ? '#b91c1c'   : '#15803d';
  el.style.border     = isError ? '1px solid #fecaca' : '1px solid #bbf7d0';
  el.style.display    = 'block';

  el.innerHTML = isError
    ? `⚠️ ${msg}<br><br>
       <a href="spend-loader.html"
          style="color:#1a3a1a;font-weight:700;text-decoration:underline">
         Open Spend Loader →
       </a>`
    : `⏳ ${msg}`;
}

function hideBootStatus() {
  const el = document.getElementById('bootStatus');
  if (el) el.style.display = 'none';
}

function updateDataStatus() {
  const el = document.getElementById('dataStatus');
  if (!el) return;
  if (S.actuals.length) {
    const years = [...new Set(S.actuals.filter(r=>r._year>0).map(r=>r._year))].sort();
    el.textContent = `${S.actuals.length.toLocaleString()} rows · ${years[0]}–${years[years.length-1]}`;
  } else {
    el.textContent = 'No data';
  }
}

/* ══════════════════════════════════════════════════════════════════
   START ANALYSIS  (was called after IndexedDB load; now called after fetch)
══════════════════════════════════════════════════════════════════ */
function startAnalysis() {
  if (!S.actuals.length) return;

  const years = [...new Set(S.actuals.filter(r => r._year > 0).map(r => r._year))].sort();
  S.years = years;
  S.selectedYear         = Math.max(...years);
  S.dashSelectedYear     = S.selectedYear;
  S.monthlySelectedYear  = S.selectedYear;
  S.fxSelectedYear       = S.selectedYear;
  S.merchantSelectedYear = S.selectedYear;
  S.insightsSelectedYear = S.selectedYear;
  S.budgetPlanYear       = S.selectedYear + 1;

  document.getElementById('mainNav').style.display        = 'flex';
  document.getElementById('sharedYearWrap').style.display = 'block';
  document.getElementById('netTicker').style.display      = 'flex';

  populateFilters();        // ← add this back
  switchTab('dashboard');   // ← add this back
}

/* ══════════════════════════════════════════════════════════════════
   HELPERS — DATA FILTERS
══════════════════════════════════════════════════════════════════ */
// Expenses only, exclude Internal Transfer sub-category
function getExpenses(rows, year) {
  return rows.filter(r =>
    r._source === 'Actuals' &&
    r._group === 'Expense' &&
    r._subcat !== 'Internal Transfer' &&
    r._subcat !== 'Intra-account transfers' &&
    (year == null || r._year === year)
  );
}

function getBudget(year) {
  return S.budget.filter(r => year == null || r._year === year);
}

function sumAmount(rows) {
  return rows.reduce((s, r) => s + r._amount, 0);
}

function groupBy(arr, fn) {
  const m = {};
  arr.forEach(r => { const k = fn(r); (m[k] = m[k] || []).push(r); });
  return m;
}

/* ══════════════════════════════════════════════════════════════════
   FORMATTERS
══════════════════════════════════════════════════════════════════ */
function fmtCHF(n, decimals=0) {
  if (!isFinite(n)) return '—';
  return "CHF\u00a0" + Math.abs(n).toLocaleString('de-CH', {minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
function fmtNum(n) {
  return n.toLocaleString('de-CH', {maximumFractionDigits:0});
}
function fmtPct(ratio) {
  if (!isFinite(ratio)) return '—';
  return Math.round(ratio * 100) + '%';
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ══════════════════════════════════════════════════════════════════
   TOOLTIP
══════════════════════════════════════════════════════════════════ */
let _tt = null;
function getTT() { if (!_tt) _tt = document.getElementById('chartTooltip'); return _tt; }
function showTT(e, title, rows) {
  const tt = getTT();
  tt.innerHTML = `<div class="tt-title">${title}</div>` +
    rows.map(r => `<div class="tt-row">
      ${r.color ? `<div class="tt-dot" style="background:${r.color}"></div>` : ''}
      <span class="tt-label">${r.label}</span>
      <span class="tt-val">${r.prefix||''}${fmtNum(Math.round(r.val))}${r.suffix||''}</span>
    </div>`).join('');
  tt.classList.add('visible');
  moveTT(e);
}
function moveTT(e) {
  const tt = getTT();
  const x = e.clientX, y = e.clientY;
  const w = tt.offsetWidth || 180, h = tt.offsetHeight || 80;
  tt.style.left = (x + 14 + w > window.innerWidth ? x - w - 10 : x + 14) + 'px';
  tt.style.top  = (y - 10 + h > window.innerHeight ? y - h - 10 : y - 10) + 'px';
}
function hideTT() { getTT().classList.remove('visible'); }


/* ══════════════════════════════════════════════════════════════════
   PILL FILTER — shared component
   Renders a horizontally-scrollable pill strip into a container.
   containerId  — id of the <div class="filter-pill-bar"> element
   options      — [{value, label}] array; first item is usually "All"
   selected     — currently selected value
   onChange     — callback(newValue)
══════════════════════════════════════════════════════════════════ */
function renderPillFilter(containerId, options, selected, onChange) {
  const el = document.getElementById(containerId);
  if (!el || !options) return;
  el.innerHTML = options.map(o =>
    `<button class="filter-pill${o.value === selected ? ' active' : ''}"
      data-value="${String(o.value).replace(/"/g, '&quot;')}"
    >${o.label}</button>`
  ).join('');
  el.querySelectorAll('.filter-pill').forEach((btn, i) => {
    btn.addEventListener('click', () => onChange(options[i].value));
  });
}
/* ══════════════════════════════════════════════════════════════════
   POPULATE FILTERS
══════════════════════════════════════════════════════════════════ */
function populateFilters() {
  // Build the shared category options list once; tabs call renderPillFilter() themselves.
  const expenses = getExpenses(S.actuals, null);
  S._catOptions = [{ value: '', label: 'All Categories' }].concat(
    [...new Set(expenses.map(r => r._category))].sort().map(c => ({ value: c, label: c }))
  );
}

/* ══════════════════════════════════════════════════════════════════
   SHARED YEAR STRIP
══════════════════════════════════════════════════════════════════ */
function renderSharedYearStrip(selectedYear) {
  const el = document.getElementById('sharedYearStrip');
  if (!el) return;
  el.innerHTML = S.years.slice().reverse().map(y =>
    `<button class="period-btn${y === selectedYear ? ' active' : ''}"
      onclick="onSharedYearSelect(${y})">${y}</button>`
  ).join('');
}

function onSharedYearSelect(year) {
  const active = document.querySelector('.tab-panel.active');
  const tabName = active ? active.id.replace('tab-', '') : 'dashboard';
  const stateKey = {
    dashboard: 'dashSelectedYear',
    monthly:   'monthlySelectedYear',
    fx:        'fxSelectedYear',
    merchants: 'merchantSelectedYear',
    insights:  'insightsSelectedYear',
  }[tabName];
  if (stateKey) S[stateKey] = year;
  S.selectedYear = year;
  renderSharedYearStrip(year);
  updateTicker(year);
  const renderers = {
    dashboard: renderDashboard, monthly: renderMonthly, trend: renderTrend,
    fx: renderFX, merchants: renderMerchants,
    insights: renderInsights, 'budget-planner': renderBudgetPlanner,
  };
  if (renderers[tabName]) renderers[tabName]();
}

// Legacy shim — no-op since the shared strip handles everything.
function renderYearStrip() {}

/* ══════════════════════════════════════════════════════════════════
   NET TICKER UPDATE
══════════════════════════════════════════════════════════════════ */
function updateTicker(year) {
  const expenses  = getExpenses(S.actuals, year);
  const ytdSpend  = sumAmount(expenses);
  const budget    = getBudget(year);
  const ytdBudget = sumAmount(budget);
  const variance  = ytdBudget > 0 ? ytdBudget - ytdSpend : null;

  document.getElementById('tickerSpend').textContent    = fmtCHF(ytdSpend);
  document.getElementById('tickerYear').textContent     = year || 'All years';
  document.getElementById('tickerYearSub').textContent  = year ? '' : `(${S.years[0]}–${S.years[S.years.length-1]})`;

  if (ytdBudget > 0) {
    document.getElementById('tickerBudget').textContent   = fmtCHF(ytdBudget);
    document.getElementById('tickerVariance').textContent = fmtCHF(Math.abs(variance));
    document.getElementById('tickerVariance').className   = 'nt-value ' + (variance >= 0 ? 'pos' : 'neg');
    const badge = document.getElementById('tickerBadge');
    badge.textContent = variance >= 0 ? '▼ Under' : '▲ Over';
    badge.className   = 'nt-badge ' + (variance >= 0 ? 'pos' : 'neg');
  } else {
    document.getElementById('tickerBudget').textContent   = '—';
    document.getElementById('tickerVariance').textContent = '—';
    document.getElementById('tickerVariance').className   = 'nt-value neu';
    document.getElementById('tickerBadge').textContent    = '';
  }
}

/* ══════════════════════════════════════════════════════════════════
   TAB SWITCH
══════════════════════════════════════════════════════════════════ */
function switchTab(tabName, btn) {
  renderSharedYearStrip(S.selectedYear);
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  if (btn) btn.classList.add('active');
  else {
    const btns  = document.querySelectorAll('.nav-btn');
    const names = ['dashboard','monthly','trend','fx','merchants','insights','budget-planner'];
    const idx   = names.indexOf(tabName);
    if (idx >= 0) btns[idx].classList.add('active');
  }

  const yr = {
    dashboard:       S.dashSelectedYear,
    monthly:         S.monthlySelectedYear,
    fx:              S.fxSelectedYear,
    merchants:       S.merchantSelectedYear,
    insights:        S.insightsSelectedYear,
    trend:           null,
    'budget-planner': null,
  }[tabName];
  updateTicker(yr !== undefined ? yr : null);

  const renderers = {
    dashboard:       renderDashboard,
    monthly:         renderMonthly,
    trend:           renderTrend,
    fx:              renderFX,
    merchants:       renderMerchants,
    insights:        renderInsights,
    'budget-planner': renderBudgetPlanner,
  };
  if (renderers[tabName]) renderers[tabName]();
}

/* ══════════════════════════════════════════════════════════════════
   CANVAS CHART LIBRARY
══════════════════════════════════════════════════════════════════ */

function prepCanvas(canvas, H) {
  const DPR = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth || 600;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, W, H);
  return { ctx, W, H, DPR };
}

function drawGridY(ctx, W, PAD, cH, mx, steps=5) {
  const style     = getComputedStyle(document.documentElement);
  const gridLine  = style.getPropertyValue('--grid-line').trim()  || '#e2e6ec';
  const gridLabel = style.getPropertyValue('--grid-label').trim() || '#9ca3af';
  for (let i = 0; i <= steps; i++) {
    const y = PAD.t + cH - (i / steps) * cH;
    ctx.strokeStyle = gridLine; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke();
    ctx.fillStyle = gridLabel; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(fmtCHF((i / steps) * mx), PAD.l - 4, y + 3);
  }
}

function drawBarLineChart(canvas, labels, barData, lineData, opts={}) {
  const H = opts.height || 200;
  const { ctx, W } = prepCanvas(canvas, H);
  const PAD = { t: 14, r: 14, b: 22, l: 74 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const n = labels.length;

  const allVals = [...barData, ...(lineData || [])].filter(v => v > 0);
  if (!allVals.length) return;
  const mx = Math.max(...allVals) * 1.12;

  drawGridY(ctx, W, PAD, cH, mx);

  const barW   = (cW / n) * 0.65;
  const barGap = cW / n;

  barData.forEach((v, i) => {
    if (v <= 0) return;
    const bh = (v / mx) * cH;
    const x  = PAD.l + i * barGap + (barGap - barW) / 2;
    const y  = PAD.t + cH - bh;
    ctx.fillStyle = opts.barColor || '#185fa5';
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, [3, 3, 0, 0]);
    ctx.fill();
  });

  if (lineData) {
    const pts = lineData.map((v, i) => ({
      x: PAD.l + i * barGap + barGap / 2,
      y: PAD.t + cH - (Math.max(0, v) / mx) * cH, v
    }));
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = opts.lineColor || '#ef9f27';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
      ctx.fillStyle = opts.lineColor || '#ef9f27'; ctx.fill();
    });
  }

  const xlStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-label').trim() || '#9ca3af';
  ctx.fillStyle = xlStyle; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    ctx.fillText(l, PAD.l + i * barGap + barGap / 2, H - 4);
  });

  canvas._chartData = { barData, lineData, labels, PAD, cW, n, barGap, barW };
  canvas.onmousemove = e => {
    const d = canvas._chartData; if (!d) return;
    const rect = canvas.getBoundingClientRect();
    const mx2 = (e.clientX - rect.left) / rect.width * W;
    const i   = Math.floor((mx2 - d.PAD.l) / d.barGap);
    if (i < 0 || i >= d.n) { hideTT(); return; }
    const rows = [{ label: 'Actual', val: d.barData[i], color: opts.barColor || '#185fa5' }];
    if (d.lineData && d.lineData[i] > 0) rows.push({ label: 'Budget', val: d.lineData[i], color: opts.lineColor || '#ef9f27' });
    showTT(e, d.labels[i], rows.filter(r => r.val > 0));
  };
  canvas.onmouseleave = hideTT;
}

function drawMultiLineChart(canvas, labels, datasets, opts={}) {
  const H = opts.height || 300;
  const { ctx, W } = prepCanvas(canvas, H);
  const PAD = { t: 14, r: 14, b: 22, l: 74 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const n = labels.length;

  const allVals = datasets.flatMap(d => d.data).filter(v => v > 0);
  if (!allVals.length) {
    const noDataColor = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#9ca3af';
    ctx.fillStyle = noDataColor; ctx.textAlign = 'center';
    ctx.font = '12px Inter,sans-serif'; ctx.fillText('No data', W/2, H/2); return;
  }
  const mx = Math.max(...allVals) * 1.12;

  drawGridY(ctx, W, PAD, cH, mx);

  const toX = i => PAD.l + (i / (n - 1 || 1)) * cW;
  const toY = v => PAD.t + cH - (Math.max(0, v) / mx) * cH;

  const allPts = datasets.map(d => d.data.map((v, i) => ({
    x: toX(i), y: toY(v), v, label: labels[i], series: d.label, color: d.color
  })));

  datasets.forEach((d, di) => {
    const pts = allPts[di];
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else {
        const prev = pts[i-1];
        ctx.bezierCurveTo((prev.x+p.x)/2, prev.y, (prev.x+p.x)/2, p.y, p.x, p.y);
      }
    });
    ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.stroke();
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
      ctx.fillStyle = d.color; ctx.fill();
    });
  });

  const xlStyleM = getComputedStyle(document.documentElement).getPropertyValue('--grid-label').trim() || '#9ca3af';
  ctx.fillStyle = xlStyleM; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'center';
  labels.forEach((l, i) => ctx.fillText(l, toX(i), H - 4));

  canvas._trendPts = allPts; canvas._trendLabels = labels;
  canvas.onmousemove = e => {
    if (!canvas._trendPts || !canvas._trendPts.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx2 = (e.clientX - rect.left) / rect.width * W;
    const firstPts = canvas._trendPts[0];
    let nearI = 0, nearD = Infinity;
    firstPts.forEach((p, i) => { const d = Math.abs(p.x - mx2); if (d < nearD) { nearD = d; nearI = i; } });
    const rows = canvas._trendPts.map(s => s[nearI]).filter(p => p && p.v > 0)
      .map(p => ({ label: p.series, val: p.v, color: p.color })).sort((a,b) => b.val - a.val);
    if (rows.length) showTT(e, canvas._trendLabels[nearI], rows);
    else hideTT();
  };
  canvas.onmouseleave = hideTT;
}

function drawStackedBarChart(canvas, labels, datasets, opts={}) {
  const H = opts.height || 200;
  const { ctx, W } = prepCanvas(canvas, H);
  const PAD = { t: 14, r: 14, b: 22, l: 74 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const n = labels.length;

  const stackTotals = labels.map((_, i) => datasets.reduce((s, d) => s + (d.data[i] || 0), 0));
  const mx = Math.max(...stackTotals, 1) * 1.12;

  drawGridY(ctx, W, PAD, cH, mx);

  const barW   = (cW / n) * 0.65;
  const barGap = cW / n;

  labels.forEach((l, i) => {
    let bottom = PAD.t + cH;
    datasets.forEach(d => {
      const v = d.data[i] || 0;
      if (v <= 0) return;
      const bh = (v / mx) * cH;
      const x  = PAD.l + i * barGap + (barGap - barW) / 2;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.roundRect(x, bottom - bh, barW, bh, bottom === PAD.t + cH ? [3,3,0,0] : 0);
      ctx.fill();
      bottom -= bh;
    });
  });

  const xlStyleS = getComputedStyle(document.documentElement).getPropertyValue('--grid-label').trim() || '#9ca3af';
  ctx.fillStyle = xlStyleS; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'center';
  labels.forEach((l, i) => ctx.fillText(l, PAD.l + i * barGap + barGap / 2, H - 4));

  canvas._stackData = { labels, datasets, PAD, n, barGap };
  canvas.onmousemove = e => {
    const d = canvas._stackData; if (!d) return;
    const rect = canvas.getBoundingClientRect();
    const mx2 = (e.clientX - rect.left) / rect.width * W;
    const i   = Math.floor((mx2 - d.PAD.l) / d.barGap);
    if (i < 0 || i >= d.n) { hideTT(); return; }
    const rows = d.datasets.map(ds => ({ label: ds.label, val: ds.data[i]||0, color: ds.color })).filter(r => r.val > 0);
    showTT(e, d.labels[i], rows);
  };
  canvas.onmouseleave = hideTT;
}

/* ══════════════════════════════════════════════════════════════════
   RESIZE
══════════════════════════════════════════════════════════════════ */
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    const active = document.querySelector('.tab-panel.active');
    if (!active) return;
    const id = active.id.replace('tab-', '');
    const renderers = {
      dashboard: renderDashboard, monthly: renderMonthly,
      trend: renderTrend, fx: renderFX, merchants: renderMerchants,
      insights: renderInsights, 'budget-planner': renderBudgetPlanner,
    };
    if (renderers[id]) renderers[id]();
  }, 200);
});

