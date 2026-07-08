/* ══════════════════════════════════════════════════════════════════
   DASHBOARD  (includes merged category section)
══════════════════════════════════════════════════════════════════ */

// Tracks which category accordion is currently open (null = all collapsed)
let _dashOpenCat = null;

function renderDashboard() {
  const year = S.dashSelectedYear || S.selectedYear;
  updateTicker(year);

  const expenses    = getExpenses(S.actuals, year);
  const budget      = getBudget(year);
  const totalSpend  = sumAmount(expenses);
  const totalBudget = sumAmount(budget);
  const txCount     = expenses.length;

  // Derived stats
  const monthCounts = [...new Set(expenses.map(r => r._year * 100 + r._month))].length;
  const avgMonthly  = monthCounts > 0 ? totalSpend / monthCounts : 0;

  // Prior-year total
  const priorExpenses = getExpenses(S.actuals, year - 1);
  const priorTotal    = sumAmount(priorExpenses);

  // Forecast EOY: actuals to date + budget for months not yet spent
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12;
  const budByMonth   = Array(12).fill(0);
  budget.forEach(r => { if (r._month >= 1 && r._month <= 12) budByMonth[r._month - 1] += r._amount; });
  const futureBudget = budByMonth.slice(currentMonth).reduce((s, v) => s + v, 0);
  const forecastEOY  = totalSpend + futureBudget;

  // Budget %
  const budPctNum  = totalBudget > 0 ? Math.round(totalSpend / totalBudget * 100) : 0;
  const fillClass  = budPctNum > 100 ? 'fill-danger' : budPctNum > 85 ? 'fill-warning' : 'fill-success';
  const budKStr    = totalBudget >= 1000
    ? (totalBudget / 1000).toFixed(totalBudget >= 10000 ? 0 : 1) + 'K'
    : fmtCHF(totalBudget);

  // ── Hero card ────────────────────────────────────────────────────
  const heroEl = document.getElementById('dashHeroCard');
  if (heroEl) {
    heroEl.innerHTML = `
      <div class="hero-strip">
        <div style="flex:1;min-width:0">
          <div class="hs-title">Total Spend ${year}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.72);margin:3px 0 0">
            Avg ${fmtCHF(avgMonthly)}/mo
          </div>
        </div>
        <div class="hs-right" style="text-align:right">
          <div class="hs-stat">${fmtCHF(totalSpend)}</div>
          ${totalBudget > 0 && forecastEOY > 0
            ? `<div style="font-size:10px;color:rgba(255,255,255,0.72);margin-top:4px">
                Forecast EOY: <strong style="color:#fff">${fmtCHF(forecastEOY)}</strong>
               </div>`
            : ''}
        </div>
      </div>

      <div class="card-body" style="padding-top:10px;padding-bottom:8px">
        ${totalBudget > 0 ? `
        <div style="margin-bottom:10px">
          <div class="progress-bg" style="position:relative;height:22px;border-radius:var(--r-sm)">
            <div class="progress-fill ${fillClass}" style="width:${Math.min(budPctNum,100)}%;height:100%;border-radius:var(--r-sm)"></div>
            <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                         font-size:11px;font-weight:600;color:var(--text);line-height:1">
              ${budPctNum}% of ${budKStr}
            </span>
          </div>
        </div>` : ''}

        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:6px;font-size:10px;color:var(--muted)">
          <span style="display:flex;align-items:center;gap:4px">
            <span style="width:18px;height:2px;background:var(--app-accent);display:inline-block"></span>This year
          </span>
          <span style="display:flex;align-items:center;gap:4px">
            <span style="width:18px;height:8px;background:rgba(239,159,39,.3);display:inline-block;border-radius:2px"></span>Prior year
          </span>
          <span style="display:flex;align-items:center;gap:4px">
            <span style="width:18px;height:0;border-top:2px dashed #5a6a7a;display:inline-block"></span>Budget
          </span>
        </div>
        <canvas id="dashMiniChart" style="width:100%;height:80px;cursor:crosshair"></canvas>
      </div>
    `;
  }

  // ── Category accordion section ───────────────────────────────────
  renderDashCategories(expenses, budget, year);

  // ── Sparkline chart ──────────────────────────────────────────────
  drawDashMiniChart(expenses, budget, year);
}

/* ─── CATEGORY ACCORDION ────────────────────────────────────────── */

function renderDashCategories(expenses, budget, year) {
  // Per-category actuals
  const catGroups = groupBy(expenses, r => r._category);
  const catBud    = groupBy(budget,   r => r._category);

  // Months elapsed in the selected year (cap at 12 for past years)
  const now          = new Date();
  const elapsedMonths = now.getFullYear() === year ? now.getMonth() + 1 : 12;

  // Merge and sort by actual desc; budget is YTD (elapsed months only)
  const allCats = new Set([...Object.keys(catGroups), ...Object.keys(catBud)]);
  const catRows = [];
  allCats.forEach(cat => {
    const actual   = sumAmount(catGroups[cat] || []);
    const budgYTD  = sumAmount((catBud[cat] || []).filter(r => r._month <= elapsedMonths));
    const count    = (catGroups[cat] || []).length;
    catRows.push({ cat, actual, budg: budgYTD, count, over: actual - budgYTD });
  });
  catRows.sort((a, b) => b.actual - a.actual);

  const hasBudget = budget.length > 0;

  const listEl = document.getElementById('dashCatList');
  if (!listEl) return;

  listEl.innerHTML = catRows.map(r => {
    // Bar colour by budget status
    let barClass, barPct;
    if (hasBudget && r.budg > 0) {
      const pct = r.actual / r.budg * 100;
      barClass  = pct > 100 ? 'fill-danger' : pct > 85 ? 'fill-warning' : 'fill-success';
      barPct    = Math.min(100, pct).toFixed(1);
    } else {
      barClass  = 'fill-success';
      barPct    = '100';
    }

    // Variance pill
    let pillHtml = '';
    if (hasBudget && r.budg > 0) {
      const varClass = r.over > 0 ? 'pill-danger' : 'pill-success';
      const varArrow = r.over > 0 ? '▲' : '▼';
      pillHtml = `<span class="pill ${varClass}" style="margin-left:8px;white-space:nowrap">
                    ${varArrow} ${fmtCHF(Math.abs(r.over))}
                  </span>`;
    }

    const isOpen   = _dashOpenCat === r.cat;
    const catSafe  = r.cat.replace(/'/g, "\\'");

    return `
    <div class="dash-cat-row ${isOpen ? 'is-open' : ''}" id="dcat-${_safeId(r.cat)}">
      <div class="ri-header clickable" onclick="toggleDashCat('${catSafe}')" style="padding:6px 0">
        <div class="ri-left" style="gap:8px;min-width:0;flex:1">
          <span class="ri-name">${r.cat}</span>
        </div>
        <div class="ri-right" style="align-items:center;gap:6px;flex-shrink:0">
          <span class="ri-value">${fmtCHF(r.actual)}</span>
          ${pillHtml}
          <span class="ri-caret" style="transition:transform .2s;transform:rotate(${isOpen?'90':'0'}deg)">›</span>
        </div>
      </div>
      <div class="progress-bg h-md" style="margin:2px 0 6px">
        <div class="progress-fill ${barClass}" style="width:${barPct}%"></div>
      </div>

      ${isOpen ? _renderCatAccordionBody(r.cat, expenses, budget, year) : ''}
    </div>`;
  }).join('');

  // Side panel: chart + merchants (reflects open category or overall)
  _renderCatSidePanel(
    _dashOpenCat,
    _dashOpenCat ? expenses.filter(r => r._category === _dashOpenCat) : expenses,
    budget,
    _dashOpenCat,
    year
  );
}

function _safeId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

function _renderCatAccordionBody(cat, expenses, budget, year) {
  const catExpenses = expenses.filter(r => r._category === cat);
  const subGroups   = groupBy(catExpenses, r => r._subcat);
  const subTotals   = Object.entries(subGroups)
    .map(([k, v]) => ({ sub: k, amount: sumAmount(v), count: v.length }))
    .sort((a, b) => b.amount - a.amount);
  const maxSub = subTotals[0]?.amount || 1;

  const subHtml = subTotals.map(s => `
    <div class="row-item" style="padding:6px 0">
      <div class="ri-header">
        <div class="ri-left">
          <span class="ri-name" style="font-size:11px">${s.sub || '(unset)'}</span>
          <span class="ri-meta">${fmtNum(s.count)} tx</span>
        </div>
        <div class="ri-right">
          <span class="ri-value" style="font-size:11px">${fmtCHF(s.amount)}</span>
        </div>
      </div>
      <div class="progress-bg" style="height:3px;margin-top:3px">
        <div style="height:3px;background:var(--app-accent);border-radius:2px;width:${(s.amount/maxSub*100).toFixed(1)}%"></div>
      </div>
    </div>`).join('');

  return `
    <div class="dash-cat-body">
      <div style="padding:8px 0 2px;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">
        Sub-categories
      </div>
      ${subHtml || '<div class="empty" style="padding:8px 0"><span class="empty-sub">No sub-categories</span></div>'}
    </div>`;
}

function _renderCatSidePanel(cat, catExpenses, budget, filterCat, year) {
  const chartCanvas = document.getElementById('dashCatChart');
  const chartTitle  = document.getElementById('dashCatChartTitle');
  const merchantEl  = document.getElementById('dashCatMerchants');

  if (chartTitle) chartTitle.textContent = cat ? `${cat} — Monthly Trend` : 'All Categories — Monthly Trend';

  // Bar chart with dotted budget line
  if (chartCanvas) {
    const byMonth  = Array(12).fill(0);
    catExpenses.forEach(r => { if (r._month >= 1 && r._month <= 12) byMonth[r._month - 1] += r._amount; });

    // Budget for this category (or all categories) by month
    const budRows   = filterCat ? budget.filter(r => r._category === filterCat) : budget;
    const budByMonth = Array(12).fill(0);
    budRows.forEach(r => { if (r._month >= 1 && r._month <= 12) budByMonth[r._month - 1] += r._amount; });

    drawBarLineChart(chartCanvas, MONTHS, byMonth, budByMonth,
      { barColor: 'var(--app-accent)', height: 160 });
  }

  // Top 15 merchants — fixed layout, truncate long names
  if (merchantEl) {
    const merchantTotals = Object.entries(groupBy(catExpenses, r => r._merchant))
      .map(([k, v]) => ({ name: k, amount: sumAmount(v), count: v.length }))
      .sort((a, b) => b.amount - a.amount).slice(0, 15);

    merchantEl.innerHTML = merchantTotals.length
      ? merchantTotals.map((m, i) => `
        <div class="merchant-row" style="display:flex;align-items:center;gap:6px;min-width:0">
          <span class="merchant-rank" style="flex-shrink:0">${i + 1}</span>
          <div style="flex:1;min-width:0;overflow:hidden">
            <div class="merchant-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name || '—'}</div>
          </div>
          <span class="merchant-count" style="flex-shrink:0">${m.count}×</span>
          <span class="merchant-amount" style="flex-shrink:0">${fmtCHF(m.amount)}</span>
        </div>`).join('')
      : '<div class="empty" style="padding:12px"><span class="empty-sub">No transactions</span></div>';
  }

  _syncCatColumnHeights();
}

function _syncCatColumnHeights() {
  // Run after paint so heights are settled
  requestAnimationFrame(() => {
    if (!document.getElementById('tab-dashboard')?.classList.contains('active')) return;
    const leftCard  = document.getElementById('dashCatListCard');
    const rightCol  = document.getElementById('dashCatRightCol');
    if (!leftCard || !rightCol) return;
    // Reset so we measure natural height
    leftCard.style.minHeight = '';
    const rightH = rightCol.getBoundingClientRect().height;
    const leftH  = leftCard.getBoundingClientRect().height;
    if (rightH > leftH) leftCard.style.minHeight = rightH + 'px';

    // Also floor the merchant tile so short lists don't collapse
    const merchantEl  = document.getElementById('dashCatMerchants');
    const chartCard   = document.getElementById('dashCatChartCard');
    const merchantCard = document.getElementById('dashCatMerchantCard');
    if (merchantEl && chartCard && merchantCard) {
      const used = chartCard.getBoundingClientRect().height + 10; // 10 = gap
      const avail = rightH - used;
      merchantCard.style.minHeight = Math.max(avail, 80) + 'px';
    }
  });
}

function toggleDashCat(cat) {
  const year     = S.dashSelectedYear || S.selectedYear;
  const expenses = getExpenses(S.actuals, year);
  const budget   = getBudget(year);

  _dashOpenCat = _dashOpenCat === cat ? null : cat;
  renderDashCategories(expenses, budget, year);
}

// Legacy entry point from dashboard category click — now just toggles accordion
function drillToCat(cat) {
  toggleDashCat(cat);
}


/* ─── MINI SPARKLINE CHART ──────────────────────────────────────── */

function drawDashMiniChart(expenses, budget, year) {
  const canvas = document.getElementById('dashMiniChart');
  if (!canvas) return;

  const byMonth = Array(12).fill(0);
  expenses.forEach(r => { if (r._month >= 1 && r._month <= 12) byMonth[r._month - 1] += r._amount; });

  const budByMonth = Array(12).fill(0);
  budget.forEach(r => { if (r._month >= 1 && r._month <= 12) budByMonth[r._month - 1] += r._amount; });

  const priorExpenses = getExpenses(S.actuals, year - 1);
  const byMonthPrior  = Array(12).fill(0);
  priorExpenses.forEach(r => { if (r._month >= 1 && r._month <= 12) byMonthPrior[r._month - 1] += r._amount; });

drawHeroSparkline(canvas, byMonth, byMonthPrior, budByMonth,
  { currentColor: 'var(--app-accent)', prefix: 'CHF ' });
}


/* ─── CHART: HERO SPARKLINE ─────────────────────────────────────── */

function drawHeroSparkline(canvas, current, prior, budget, opts = {}) {
  const DPR = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 600;
  const H = 80;
  canvas.width  = W * DPR; canvas.height = H * DPR;
  canvas.style.width  = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, W, H);

  const labels   = opts.labels || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const curColor = opts.currentColor || '#71879c';
  const priColor = opts.priorColor   || '#2b5024';
  const budColor = opts.budgetColor  || '#6454bc';

  const all = [...current, ...prior, ...budget].filter(v => v > 0);
  if (!all.length) return;
  const mx = Math.max(...all) * 1.08;

  const PAD = { l: 2, r: 2, t: 6, b: 18 };
  const cW  = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const n   = labels.length;

  const toX    = i   => PAD.l + (i / (n - 1)) * cW;
  const toY    = v   => PAD.t + cH - ((v || 0) / mx) * cH;
  const makePts = arr => arr.map((v, i) => ({ x: toX(i), y: toY(v > 0 ? v : 0) }));

  ctx.fillStyle = '#aaa'; ctx.font = '8px Inter,sans-serif'; ctx.textAlign = 'center';
  labels.forEach((m, i) => ctx.fillText(m, toX(i), H - 3));

  _drawArea(ctx, makePts(prior),   priColor + '30', priColor + '88', 1.2);
  _drawArea(ctx, makePts(current), curColor + '22', curColor, 2);

  const bPts = makePts(budget);
  ctx.beginPath(); ctx.moveTo(bPts[0].x, bPts[0].y);
  bPts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.setLineDash([5, 4]); ctx.strokeStyle = budColor; ctx.lineWidth = 1.5;
  ctx.stroke(); ctx.setLineDash([]);

  canvas._sparkData = { current, prior, budget, labels };

  canvas.onmousemove = e => {
    if (!canvas._sparkData) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left) / rect.width * n;
    const idx  = Math.max(0, Math.min(n - 1, Math.round(mx)));
    const { current: c, prior: p, budget: b, labels: ls } = canvas._sparkData;
    const rows = [];
    const pre  = opts.prefix || '';
    if (c[idx] > 0) rows.push({ label: `${ls[idx]} Actuals`,  val: c[idx], color: curColor, prefix: pre });
    if (p[idx] > 0) rows.push({ label: `${ls[idx]} Prior yr`, val: p[idx], color: priColor, prefix: pre });
    if (b[idx] > 0) rows.push({ label: `${ls[idx]} Budget`,   val: b[idx], color: budColor, prefix: pre });
    if (rows.length) showTT(e, ls[idx], rows);
  };
  canvas.onmouseleave = hideTT;
}

function _drawArea(ctx, pts, fillColor, strokeColor, lineWidth) {
  if (!pts.length) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    ctx.bezierCurveTo((p.x + q.x) / 2, p.y, (p.x + q.x) / 2, q.y, q.x, q.y);
  }
  const last = pts[pts.length - 1], first = pts[0];
  ctx.lineTo(last.x, last.y + 60); ctx.lineTo(first.x, first.y + 60);
  ctx.closePath();
  ctx.fillStyle = fillColor; ctx.fill();

  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    ctx.bezierCurveTo((p.x + q.x) / 2, p.y, (p.x + q.x) / 2, q.y, q.x, q.y);
  }
  ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth; ctx.setLineDash([]); ctx.stroke();
}