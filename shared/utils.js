/**
 * SAHANI SUITE — utils.js  v1.0
 * ─────────────────────────────────────────────────────────────────────
 * Shared utilities loaded by every app via:
 *   <script src="../shared/utils.js"></script>
 *
 * Provides:
 *   Data:     fetchData(path) → Promise<any>
 *   Format:   fmt(n), fmtK(n), fmtPct(n), pn(val, display?)
 *   Tooltip:  showTT(e, title, rows), moveTT(e), hideTT()
 *   Privacy:  togglePrivacy(password), showPasswordModal()
 *   Period:   renderPeriodStrip(containerId, periods, selected, onSelect)
 *   Charts:   drawTrendChart(canvas, series, labels, colors)
 *             drawHeroSparkline(canvas, current, prior, budget)
 *   Sync:     syncToGitHub(config, buildPayload, indicatorId?)
 *             promptForGitToken()
 * ─────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ─── DATA LOADING ──────────────────────────────────────────────────── */

/**
 * Fetch and parse a JSON data file.
 * Shows a friendly in-page error if the fetch fails (e.g. no web server).
 * @param {string} path  Relative path to the JSON file, e.g. './data.json'
 * @param {string} [errorContainerId='app']  ID of the element to show errors in
 * @returns {Promise<object|null>}
 */
async function fetchData(path, errorContainerId = 'app') {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    const el = document.getElementById(errorContainerId);
    if (el) {
      el.innerHTML = `
        <div style="margin:40px auto;max-width:500px;background:#fff;border:1px solid #e0ddd7;border-radius:13px;padding:24px">
          <div style="font-size:15px;font-weight:600;color:#0c2340;margin-bottom:8px">⚠️ Cannot load ${path}</div>
          <div style="font-size:12px;color:#666;line-height:1.7">
            This app reads its data from a local JSON file and requires a web server.<br><br>
            <strong>Start one in the project root:</strong><br>
            <code style="background:#f5f4f0;padding:4px 8px;border-radius:6px;display:inline-block;margin:4px 0">python3 -m http.server 8080</code><br>
            Then open <a href="http://localhost:8080" style="color:#185fa5">http://localhost:8080</a>
          </div>
        </div>`;
    }
    console.error('fetchData failed:', e);
    return null;
  }
}


/**
 * Fetch a JSON data file from a private GitHub repository.
 * Uses the PAT stored under 'gh_pat_token' in localStorage (same key as
 * syncToGitHub / promptForGitToken). Falls back to a friendly in-page
 * error when the token is absent or the fetch fails.
 *
 * Typical usage (read-only apps):
 *   const raw = await fetchFromGitHub(GITHUB_CONFIG);
 *   if (!raw) return;          // error already rendered
 *
 * @param {{owner:string, repo:string, path:string, branch:string}} config
 * @param {string} [errorContainerId='app']
 * @returns {Promise<object|null>}
 */
async function fetchFromGitHub(config, errorContainerId = 'app') {
  const token = localStorage.getItem('gh_pat_token');

  function _renderError(html) {
    const el = document.getElementById(errorContainerId);
    if (el) el.innerHTML = html;
    console.error('fetchFromGitHub:', html.replace(/<[^>]+>/g, ' '));
  }

  if (!token) {
    _renderError(`
      <div style="margin:40px auto;max-width:500px;background:#fff;border:1px solid #e0ddd7;border-radius:13px;padding:24px">
        <div style="font-size:15px;font-weight:600;color:#0c2340;margin-bottom:8px">🔑 GitHub token required</div>
        <div style="font-size:12px;color:#666;line-height:1.7">
          This app loads its data from a private GitHub repository.<br><br>
          Tap the <strong>🔑</strong> button in the header to enter your Personal Access Token.
          The token is stored locally on this device only and never leaves it.
        </div>
      </div>`);
    return null;
  }

  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?ref=${config.branch}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status}`);
    const meta = await res.json();
    return JSON.parse(atob(meta.content.replace(/\n/g, '')));
  } catch (e) {
    _renderError(`
      <div style="margin:40px auto;max-width:500px;background:#fff;border:1px solid #e0ddd7;border-radius:13px;padding:24px">
        <div style="font-size:15px;font-weight:600;color:#0c2340;margin-bottom:8px">⚠️ Cannot load data from GitHub</div>
        <div style="font-size:12px;color:#666;line-height:1.7">
          Failed to fetch <code>${config.path}</code> from
          <strong>${config.owner}/${config.repo}</strong>.<br><br>
          Error: ${e.message}<br><br>
          Check your GitHub token (🔑 in the header) or verify the file exists in the repo.
        </div>
      </div>`);
    return null;
  }
}


/* ─── NUMBER FORMATTING ─────────────────────────────────────────────── */

/**
 * Format a number with thousands separator, rounded to integer.
 * Uses Swiss-style formatting (apostrophe thousands separator).
 * Override locale as needed per project.
 */
function fmt(n) {
  return Math.round(n).toLocaleString('de-CH');
}

/** Format as compact e.g. 1200 → "1.2k", 450 → "450" */
function fmtK(n) {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.round(n));
}

/** Format as percentage string e.g. 0.72 → "72%" */
function fmtPct(ratio) {
  return Math.round(ratio * 100) + '%';
}

/**
 * Wrap a formatted number in a privacy-masked span.
 * Use whenever rendering a number that should blur in privacy mode.
 * @param {number}  val        The raw number (used for fallback display)
 * @param {string}  [display]  Pre-formatted string to display (optional)
 * @returns {string} HTML string
 */
function pn(val, display) {
  const shown = display !== undefined ? display : fmt(val);
  return `<span class="num-private">${shown}</span>`;
}

/** Simple sum helper */
function sumBy(arr, fn) {
  return arr.reduce((s, r) => { const v = fn ? fn(r) : r; return s + (isFinite(v) ? v : 0); }, 0);
}


/* ─── TOOLTIP ───────────────────────────────────────────────────────── */

let _tt = null;
function _ensureTT() {
  if (!_tt) _tt = document.getElementById('chartTooltip');
  return _tt;
}

/**
 * Show the shared chart tooltip.
 * Suppressed automatically in privacy mode.
 * @param {MouseEvent|TouchEvent} e
 * @param {string} title
 * @param {Array<{label:string, val:number, color?:string}>} rows
 */
function showTT(e, title, rows) {
  if (document.body.classList.contains('privacy')) return;
  const tt = _ensureTT();
  if (!tt) return;
  tt.innerHTML =
    `<div class="tt-title">${title}</div>` +
    rows.map(r =>
      `<div class="tt-row">
        ${r.color ? `<div class="tt-dot" style="background:${r.color}"></div>` : ''}
        <span class="tt-label">${r.label}</span>
        <span class="tt-val">${r.prefix || ''}${fmt(r.val)}${r.suffix || ''}</span>
      </div>`
    ).join('');
  tt.classList.add('visible');
  moveTT(e);
}

function moveTT(e) {
  const tt = _ensureTT();
  if (!tt) return;
  const x = e.clientX, y = e.clientY;
  const w = tt.offsetWidth || 160, h = tt.offsetHeight || 60;
  tt.style.left = (x + 14 + w > window.innerWidth  ? x - w - 10 : x + 14) + 'px';
  tt.style.top  = (y - 10 + h > window.innerHeight ? y - h - 10 : y - 10) + 'px';
}

function hideTT() {
  const tt = _ensureTT();
  if (tt) tt.classList.remove('visible');
}

// Dismiss tooltip on mobile tap outside any canvas
document.addEventListener('touchstart', e => {
  if (!e.target.closest('canvas')) hideTT();
}, { passive: true });


/* ─── PRIVACY MODE ──────────────────────────────────────────────────── */

let _privacyPassword = null;

/**
 * Call once during app init to set the privacy unlock password.
 * @param {string} password
 */
function setPrivacyPassword(password) {
  _privacyPassword = password;
}

/** Toggle privacy mode. Turning off requires password if one is set. */
function togglePrivacy() {
  if (!document.body.classList.contains('privacy')) {
    // Turn ON — no password needed
    document.body.classList.add('privacy');
    const btn = document.getElementById('privacyBtn');
    if (btn) btn.textContent = '🔐';
    // Re-render sections that use innerHTML so .num-private nodes exist
    if (typeof onPrivacyChange === 'function') onPrivacyChange(true);
  } else {
    // Turn OFF — password gate
    if (_privacyPassword) {
      showPasswordModal();
    } else {
      _applyPrivacyOff();
    }
  }
}

function _applyPrivacyOff() {
  document.body.classList.remove('privacy');
  const btn = document.getElementById('privacyBtn');
  if (btn) btn.textContent = '🔒';
  if (typeof onPrivacyChange === 'function') onPrivacyChange(false);
}

function showPasswordModal() {
  const overlay = document.createElement('div');
  overlay.className = 'pw-overlay';
  overlay.id = 'pwOverlay';
  overlay.innerHTML = `
    <div class="pw-modal">
      <div class="pw-title">🔒 Privacy lock</div>
      <div class="pw-sub">Enter the password to reveal your data</div>
      <input class="pw-input" id="pwInput" type="password" placeholder="Password" autocomplete="off">
      <div class="pw-error" id="pwError"></div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-cancel" onclick="closePasswordModal()">Cancel</button>
        <button class="pw-btn pw-btn-confirm" onclick="submitPassword()">Unlock</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    const inp = document.getElementById('pwInput');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') submitPassword();
        if (e.key === 'Escape') closePasswordModal();
      });
    }
  });
}

function closePasswordModal() {
  const el = document.getElementById('pwOverlay');
  if (el) el.remove();
}

function submitPassword() {
  const input = document.getElementById('pwInput');
  if (!input) return;
  if (input.value === _privacyPassword) {
    closePasswordModal();
    _applyPrivacyOff();
  } else {
    const err = document.getElementById('pwError');
    if (err) err.textContent = 'Incorrect password — try again';
    input.value = '';
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    input.focus();
  }
}


/* ─── PERIOD STRIP ──────────────────────────────────────────────────── */

/**
 * Render a row of period selector pills.
 * @param {string}   containerId  ID of the container div
 * @param {Array}    periods      Array of values (numbers or strings)
 * @param {*}        selected     Currently selected value
 * @param {Function} onSelect     Callback(selectedValue)
 * @param {Object}   [opts]
 * @param {boolean}  [opts.reverse]  Render newest first
 */
function renderPeriodStrip(containerId, periods, selected, onSelect, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const list = opts.reverse ? [...periods].reverse() : periods;
  el.innerHTML = list.map(p =>
    `<button class="period-btn${p === selected ? ' active' : ''}"
      onclick="(${onSelect.toString()})(${JSON.stringify(p)})">${p}</button>`
  ).join('');
}


/* ─── CHART: MULTI-LINE TREND ───────────────────────────────────────── */

/**
 * Draw a multi-series line chart on a canvas element.
 * Attaches mousemove tooltip handler automatically.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{name:string, data:number[]}>} series
 * @param {string[]} labels    X-axis labels (years, months, etc.)
 * @param {string[]} colors    One colour per series
 * @param {object}  [opts]
 * @param {string}  [opts.prefix]   Tooltip value prefix e.g. 'CHF '
 * @param {string}  [opts.suffix]   Tooltip value suffix e.g. ' kcal'
 */
function drawTrendChart(canvas, series, labels, colors, opts = {}) {
  const DPR = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 600;
  const H = 160;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, W, H);

  const PAD = { t: 12, r: 10, b: 28, l: 44 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  const allVals = series.flatMap(s => s.data).filter(v => isFinite(v) && v > 0);
  if (!allVals.length) return;
  const mx = Math.max(...allVals) * 1.1;

  // Grid lines + Y labels
  ctx.strokeStyle = '#e8e6e0'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.t + cH - (i / 4) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cW, y); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(fmtK((i / 4) * mx), PAD.l - 4, y + 3);
  }

  // X labels
  ctx.fillStyle = '#999'; ctx.font = '8px Inter,sans-serif'; ctx.textAlign = 'center';
  labels.forEach((lbl, i) => {
    ctx.fillText(lbl, PAD.l + (i / (labels.length - 1 || 1)) * cW, H - 6);
  });

  // Build pts
  const allPts = series.map((s, si) =>
    s.data.map((v, i) => ({
      x: PAD.l + (i / (labels.length - 1 || 1)) * cW,
      y: PAD.t + cH - ((v || 0) / mx) * cH,
      v, label: labels[i], series: s.name, color: colors[si]
    }))
  );

  // Draw lines + dots
  series.forEach((s, si) => {
    const pts = allPts[si];
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i-1], q = pts[i];
      ctx.bezierCurveTo((p.x+q.x)/2, p.y, (p.x+q.x)/2, q.y, q.x, q.y);
    }
    ctx.strokeStyle = colors[si]; ctx.lineWidth = 1.8; ctx.setLineDash([]); ctx.stroke();
    pts.forEach(pt => {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = colors[si]; ctx.fill();
    });
  });

  canvas._trendPts = allPts;
  canvas._trendLabels = labels;

  canvas.onmousemove = e => {
    if (!canvas._trendPts) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width / DPR);
    let nearestI = 0, nearestD = Infinity;
    canvas._trendPts[0].forEach((pt, i) => {
      const d = Math.abs(pt.x - mx);
      if (d < nearestD) { nearestD = d; nearestI = i; }
    });
    if (nearestD > cW / labels.length) { hideTT(); return; }
    const lbl = canvas._trendLabels[nearestI];
    const rows = canvas._trendPts
      .map(s => s[nearestI])
      .filter(pt => pt && pt.v > 0)
      .map(pt => ({ label: pt.series, val: pt.v, color: pt.color, prefix: opts.prefix, suffix: opts.suffix }))
      .sort((a, b) => b.val - a.val);
    if (rows.length) showTT(e, String(lbl), rows);
  };
  canvas.onmouseleave = hideTT;
}


/* ─── CHART: HERO SPARKLINE ─────────────────────────────────────────── */

/**
 * Draw the hero area chart with current year, prior year, and budget overlays.
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} current   Monthly actuals for selected year (12 values)
 * @param {number[]} prior     Monthly actuals for prior year
 * @param {number[]} budget    Monthly budget for selected year
 * @param {object}  [opts]
 * @param {string}  [opts.currentColor]  Defaults to app-accent via CSS var
 * @param {string}  [opts.priorColor]    Defaults to amber
 * @param {string}  [opts.budgetColor]   Defaults to slate
 * @param {string[]} [opts.labels]       X-axis labels (default: month names)
 * @param {string}  [opts.prefix]        Tooltip prefix
 */
function drawHeroSparkline(canvas, current, prior, budget, opts = {}) {
  const DPR = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 600;
  const H = 80;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, W, H);

  const labels = opts.labels || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const curColor = opts.currentColor || '#185fa5';
  const priColor = opts.priorColor   || '#ef9f27';
  const budColor = opts.budgetColor  || '#5a6a7a';

  const all = [...current, ...prior, ...budget].filter(v => v > 0);
  if (!all.length) return;
  const mx = Math.max(...all) * 1.08;

  const PAD = { l: 2, r: 2, t: 6, b: 18 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const n = labels.length;

  const toX = i => PAD.l + (i / (n - 1)) * cW;
  const toY = v => PAD.t + cH - ((v || 0) / mx) * cH;
  const makePts = arr => arr.map((v, i) => ({ x: toX(i), y: toY(v > 0 ? v : 0) }));

  // X labels
  ctx.fillStyle = '#aaa'; ctx.font = '8px Inter,sans-serif'; ctx.textAlign = 'center';
  labels.forEach((m, i) => ctx.fillText(m, toX(i), H - 3));

  // ── Prior year area (amber)
  _drawArea(ctx, makePts(prior), priColor + '30', priColor + '88', 1.2);

  // ── Current year area (accent)
  _drawArea(ctx, makePts(current), curColor + '22', curColor, 2);

  // ── Budget dashed line
  const bPts = makePts(budget);
  ctx.beginPath(); ctx.moveTo(bPts[0].x, bPts[0].y);
  bPts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.setLineDash([5, 4]); ctx.strokeStyle = budColor; ctx.lineWidth = 1.5;
  ctx.stroke(); ctx.setLineDash([]);

  // Store for tooltip
  canvas._sparkData = { current, prior, budget, labels };

  canvas.onmousemove = e => {
    if (!canvas._sparkData) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * n;
    const idx = Math.max(0, Math.min(n - 1, Math.round(mx)));
    const { current: c, prior: p, budget: b, labels: ls } = canvas._sparkData;
    const rows = [];
    const pre = opts.prefix || '';
    if (c[idx] > 0) rows.push({ label: `${ls[idx]} Actuals`, val: c[idx], color: curColor, prefix: pre });
    if (p[idx] > 0) rows.push({ label: `${ls[idx]} Prior yr`, val: p[idx], color: priColor, prefix: pre });
    if (b[idx] > 0) rows.push({ label: `${ls[idx]} Budget`,  val: b[idx], color: budColor, prefix: pre });
    if (rows.length) showTT(e, ls[idx], rows);
  };
  canvas.onmouseleave = hideTT;
}

function _drawArea(ctx, pts, fillColor, strokeColor, lineWidth) {
  if (!pts.length) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i-1], q = pts[i];
    ctx.bezierCurveTo((p.x+q.x)/2, p.y, (p.x+q.x)/2, q.y, q.x, q.y);
  }
  const last = pts[pts.length - 1], first = pts[0];
  ctx.lineTo(last.x, last.y + 60); ctx.lineTo(first.x, first.y + 60);
  ctx.closePath();
  ctx.fillStyle = fillColor; ctx.fill();

  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i-1], q = pts[i];
    ctx.bezierCurveTo((p.x+q.x)/2, p.y, (p.x+q.x)/2, q.y, q.x, q.y);
  }
  ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth; ctx.setLineDash([]); ctx.stroke();
}


/* ─── RESIZE HANDLER HELPER ─────────────────────────────────────────── */

/**
 * Re-draw all registered canvases on window resize.
 * Apps call registerChartRedraw(fn) for each chart that needs redrawing.
 */
const _redrawFns = [];
function registerChartRedraw(fn) { _redrawFns.push(fn); }
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => _redrawFns.forEach(fn => fn()), 150);
});


/* ─── GITHUB AUTO-SYNC ──────────────────────────────────────────────── */

// ── In-flight guard + pending queue ─────────────────────────────────
// Prevents concurrent syncs from the same tab racing on the same SHA.
// If a sync is already running, the latest call is held as _syncPending
// (superseding any earlier queued call). When the in-flight sync
// finishes, the pending one is dispatched automatically.
let _syncInFlight = false;
let _syncPending  = null;

/**
 * Generic GitHub auto-sync: PUTs a JSON payload to a file in a GitHub repo.
 * Improvements over v1:
 *   • In-flight guard + pending queue (prevents same-tab SHA races)
 *   • Cache-busted SHA fetch (fixes desktop browser caching staleness)
 *   • Automatic one-shot retry on 409/422 conflict (cross-device contention)
 *   • Classified error messages (bad token / conflict / rate-limit / network)
 *   • Non-blocking toast instead of alert()
 *
 * Public API is unchanged — no call-sites need updating.
 *
 * @param {{owner:string, repo:string, path:string, branch:string}} config
 * @param {() => object} buildPayload  Called at sync time; returns JSON-serialisable object
 * @param {string} [indicatorId='syncIndicator']
 */
async function syncToGitHub(config, buildPayload, indicatorId = 'syncIndicator') {
  const token = localStorage.getItem('gh_pat_token');
  if (!token) {
    console.log('syncToGitHub: no token — saved locally only.');
    return;
  }

  if (_syncInFlight) {
    // Hold the latest request; discard any earlier pending one.
    _syncPending = { config, buildPayload, indicatorId };
    console.log('syncToGitHub: queued (sync already in flight).');
    return;
  }

  _syncInFlight = true;
  try {
    await _doGitHubSync(config, buildPayload, indicatorId, token);
  } finally {
    _syncInFlight = false;
    if (_syncPending) {
      const next   = _syncPending;
      _syncPending = null;
      // Kick off the queued sync in the next microtask so the call stack unwinds.
      Promise.resolve().then(() =>
        syncToGitHub(next.config, next.buildPayload, next.indicatorId)
      );
    }
  }
}

/** Internal: runs a single sync attempt with one retry on SHA conflict. */
async function _doGitHubSync(config, buildPayload, indicatorId, token) {
  const ind = document.getElementById(indicatorId);
  if (ind) ind.style.display = 'inline-block';

  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
  const authHeaders = {
    'Authorization': `token ${token}`,
    'Accept':        'application/vnd.github.v3+json',
    'Content-Type':  'application/json',
  };

  try {
    const sha = await _ghFetchSha(url, authHeaders);
    await _ghPut(url, authHeaders, config.branch, buildPayload, sha);
    console.log('syncToGitHub: success.');
    _syncToast('✓ Saved to GitHub', 'success');

  } catch (err) {
    // ── Conflict: another write landed between our GET and PUT.
    // Re-fetch the now-current SHA and retry once.
    if (err.ghStatus === 409 || err.ghStatus === 422) {
      console.warn('syncToGitHub: SHA conflict — retrying with fresh SHA…');
      try {
        const freshSha = await _ghFetchSha(url, authHeaders);
        await _ghPut(url, authHeaders, config.branch, buildPayload, freshSha);
        console.log('syncToGitHub: success after conflict retry.');
        _syncToast('✓ Saved to GitHub', 'success');
        return;
      } catch (retryErr) {
        _syncHandleError(retryErr, /*afterRetry=*/true);
        return;
      }
    }
    _syncHandleError(err, false);

  } finally {
    if (ind) ind.style.display = 'none';
  }
}

/**
 * Fetch the current SHA of the file (needed for PUT).
 * Cache-busted with ?t= so desktop browsers never serve a stale ETag.
 * Returns '' for a brand-new file (404).
 */
async function _ghFetchSha(url, headers) {
  const res = await fetch(`${url}?t=${Date.now()}`, {
    headers: { ...headers, 'Cache-Control': 'no-cache' },
  });
  if (res.ok)              return (await res.json()).sha;
  if (res.status === 404)  return '';          // file doesn't exist yet — that's fine

  const err = new Error(`SHA fetch: HTTP ${res.status}`);
  err.ghStatus = res.status;
  throw err;
}

/** PUT the payload. Throws a classified error on non-2xx. */
async function _ghPut(url, headers, branch, buildPayload, sha) {
  const body = {
    message: 'Sync updates from app [Automated]',
    content: btoa(unescape(encodeURIComponent(JSON.stringify(buildPayload(), null, 2)))),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (res.ok) return;

  const json = await res.json().catch(() => ({}));
  const err  = new Error(json.message || `HTTP ${res.status}`);
  err.ghStatus = res.status;
  throw err;
}

/** Map HTTP status → human message, then show a toast. */
function _syncHandleError(err, afterRetry) {
  const tag = afterRetry ? ' (after retry)' : '';
  let title, detail;

  switch (err.ghStatus) {
    case 401:
      title  = '⚠ GitHub token rejected';
      detail = 'Your Personal Access Token may have expired or been revoked. Tap 🔑 in the header to update it.';
      break;
    case 403:
      title  = '⚠ GitHub access denied';
      detail = 'Check that your token has repo write access, or you may have hit the API rate limit — wait a minute and try again.';
      break;
    case 409:
    case 422:
      title  = '⚠ Save conflict' + tag;
      detail = 'Another device saved at the same time and the retry also failed. Refresh the page to get the latest data, then re-apply your change.';
      break;
    default:
      title  = `⚠ Sync failed${tag}`;
      detail = `Your data is saved locally. Check your connection and try again. (${err.message})`;
  }

  console.error('syncToGitHub' + tag + ':', err);
  _syncToast(title, 'error', detail);
}

/**
 * Non-blocking status toast — replaces the old alert().
 * Auto-dismisses after 3 s (success) or 10 s (error).
 */
function _syncToast(message, type = 'info', detail = '') {
  document.getElementById('_syncToast')?.remove();

  // Inject keyframe once
  if (!document.getElementById('_syncToastStyle')) {
    const s = document.createElement('style');
    s.id = '_syncToastStyle';
    s.textContent = `
      @keyframes _syncToastIn  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      @keyframes _syncToastOut { from { opacity:1 } to { opacity:0 } }
    `;
    document.head.appendChild(s);
  }

  const colours = {
    success: { bg: '#162a16', border: '#3b6d11' },
    error:   { bg: '#2a1616', border: '#c0392b' },
    info:    { bg: '#0c1a2a', border: '#185fa5' },
  };
  const { bg, border } = colours[type] || colours.info;
  const delay = type === 'error' ? 10000 : 3000;

  const el = document.createElement('div');
  el.id = '_syncToast';
  el.style.cssText = `
    position:fixed; bottom:20px; right:16px; z-index:99999;
    background:${bg}; border:1px solid ${border}; border-radius:10px;
    padding:10px 14px; font-size:12px; color:#fff; max-width:300px;
    font-family:Inter,-apple-system,sans-serif; line-height:1.45;
    box-shadow:0 4px 20px rgba(0,0,0,.45);
    animation: _syncToastIn .2s ease forwards;
  `;
  el.innerHTML = `<div style="font-weight:600">${message}</div>`
    + (detail ? `<div style="opacity:.72;margin-top:3px;font-size:11px">${detail}</div>` : '');

  document.body.appendChild(el);
  setTimeout(() => { el.style.animation = '_syncToastOut .3s ease forwards'; }, delay);
  setTimeout(() => el.remove(), delay + 320);
}

/**
 * Prompt for / clear the GitHub Personal Access Token used by syncToGitHub.
 * Reloads data afterwards via the app's own loadData(), if one is defined.
 */
function promptForGitToken() {
  const current = localStorage.getItem('gh_pat_token') || '';
  const token = prompt('Enter your GitHub Personal Access Token:', current);
  if (token !== null) {
    if (token.trim() === '') {
      localStorage.removeItem('gh_pat_token');
      alert('Token removed.');
    } else {
      localStorage.setItem('gh_pat_token', token.trim());
      alert('Token saved to this device.');
      if (typeof loadData === 'function') loadData();
    }
  }
}

/* ─── CROSS-APP DATA HELPERS (for integration) ──────────────────────── */

/**
 * Load and filter recipe by ID from recipes.json.
 * Used by calorie planner to look up macro info.
 */
async function getRecipeById(recipeId, dataPath = './data/recipes.json') {
  try {
    const data = await fetchData(dataPath);
    return data?.recipes?.find(r => r.id === String(recipeId)) || null;
  } catch(e) { console.error('getRecipeById:', e); return null; }
}

/**
 * Get all recipes matching a category (e.g. 'Curry', 'Breakfast').
 * Used by calorie planner to suggest recipes by meal type.
 */
async function getRecipesByCategory(category, dataPath = './data/recipes.json') {
  try {
    const data = await fetchData(dataPath);
    return data?.recipes?.filter(r => r.category === category) || [];
  } catch(e) { console.error('getRecipesByCategory:', e); return []; }
}

/**
 * Get training session for a given date from training.json.
 * Returns { type, plannedKm, notes } or null if not found.
 */
async function getTrainingForDate(dateStr, dataPath = './data/training.json') {
  try {
    const data = await fetchData(dataPath);
    for (let week of (data?.weeks || [])) {
      const session = week.sessions?.find(s => s.date === dateStr);
      if (session) return session;
    }
    return null;
  } catch(e) { console.error('getTrainingForDate:', e); return null; }
}

/**
 * Get all training sessions in a week range (startDate → endDate).
 * Returns array of { date, type, plannedKm, actualKm, notes }.
 */
async function getTrainingWeek(startDate, endDate, dataPath = './data/training.json') {
  try {
    const data = await fetchData(dataPath);
    const result = [];
    for (let week of (data?.weeks || [])) {
      const filtered = (week.sessions || []).filter(s => s.date >= startDate && s.date <= endDate);
      result.push(...filtered);
    }
    return result;
  } catch(e) { console.error('getTrainingWeek:', e); return []; }
}

/**
 * Get calorie phase that applies to a given date from calories.json.
 * Returns { label, start_date, end_date, avg_kcal, rest_kcal, run_kcal, long_kcal }.
 */
async function getCaloriePhaseForDate(dateStr, dataPath = './data/calories.json') {
  try {
    const data = await fetchData(dataPath);
    return (data?.phases || []).find(p => dateStr >= p.start_date && dateStr <= p.end_date) || null;
  } catch(e) { console.error('getCaloriePhaseForDate:', e); return null; }
}

/**
 * Get upcoming trip from travel.json with status = 'Planned' or 'Confirmed'.
 * Used by dashboard to show next trip.
 */
async function getUpcomingTrips(limit = 3, dataPath = './data/travel.json') {
  try {
    const data = await fetchData(dataPath);
    const now = new Date().toISOString().slice(0, 10);
    return (data?.trips || [])
      .filter(t => (t.status === 'Planned' || t.status === 'Confirmed') && t.startDate >= now)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, limit);
  } catch(e) { console.error('getUpcomingTrips:', e); return []; }
}

/**
 * Get current/active training race goal from training.json.
 */
async function getRaceGoal(dataPath = './data/training.json') {
  try {
    const data = await fetchData(dataPath);
    return data?.profile?.raceGoal || null;
  } catch(e) { console.error('getRaceGoal:', e); return null; }
}

/**
 * Format date as "Mon 12" for dashboard tiles.
 */
function fmtDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  return `${dayName} ${d.getDate()}`;
}

/**
 * Get days remaining until target date.
 */
function daysUntil(targetDate) {
  const now = new Date();
  const target = new Date(targetDate + 'T00:00:00');
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}