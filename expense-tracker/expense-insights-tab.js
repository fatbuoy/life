/* ══════════════════════════════════════════════════════════════════
   INSIGHTS TAB
══════════════════════════════════════════════════════════════════ */

/* ── Stats helpers ───────────────────────────────────────────────── */
function mean(arr) { return arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0; }
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/(arr.length-1));
}

function renderInsights() {
  const year = S.insightsSelectedYear || S.selectedYear;
  updateTicker(year);

  const expenses = getExpenses(S.actuals, year);
  const allExpenses = getExpenses(S.actuals, null);

  _renderRecurring(expenses, year);
  _renderAnomalies(expenses);
  _renderCalendarPatterns(expenses);
  _renderGrowthTable(allExpenses);
}

/* ── Recurring vs Variable ───────────────────────────────────────── */
function _renderRecurring(expenses, year) {
  // A merchant is "recurring" if it appears in >= 3 distinct months in the selected period
  const byMerchant = groupBy(expenses, r => r._merchant);
  const recurring = [], variable = [];
  let recurringTotal = 0, variableTotal = 0;

  Object.entries(byMerchant).forEach(([name, rows]) => {
    const months = new Set(rows.map(r => r._year * 100 + r._month));
    const total = sumAmount(rows);
    const entry = { name, total, count: rows.length, months: months.size,
                    avg: total / months.size, cat: rows[0]._category };
    if (months.size >= 3) { recurring.push(entry); recurringTotal += total; }
    else { variable.push(entry); variableTotal += total; }
  });

  recurring.sort((a,b) => b.total - a.total);
  const grandTotal = recurringTotal + variableTotal;
  const recPct = grandTotal > 0 ? recurringTotal / grandTotal : 0;

  // KPIs
  document.getElementById('insightsRecurringKpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-label">Recurring</div>
      <div class="kpi-value" style="color:var(--accent)">${fmtCHF(recurringTotal)}</div>
      <div class="kpi-sub">${fmtPct(recPct)} of total · ${recurring.length} merchants</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Variable</div>
      <div class="kpi-value" style="color:var(--yellow)">${fmtCHF(variableTotal)}</div>
      <div class="kpi-sub">${fmtPct(1-recPct)} of total · ${variable.length} merchants</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Fixed floor / month</div>
      <div class="kpi-value" style="font-size:18px">${fmtCHF(recurringTotal / 12)}</div>
      <div class="kpi-sub">Min committed monthly spend</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Recurring merchants</div>
      <div class="kpi-value" style="font-size:20px">${recurring.length}</div>
      <div class="kpi-sub">Appearing in 3+ months</div>
    </div>
  `;

  document.getElementById('recurringNote').textContent = `${recurring.length} merchants · 3+ months`;

  // List
  document.getElementById('insightsRecurringList').innerHTML = recurring.slice(0, 15).map(m => `
    <div class="merchant-row">
      <div style="flex:1;min-width:0">
        <div class="merchant-name">${m.name || '(unnamed)'}</div>
        <div class="merchant-cat">${m.cat} · ${m.months} months · avg ${fmtCHF(m.avg)}/mo</div>
      </div>
      <span class="pill pill-blue" style="margin-right:8px">${m.months}mo</span>
      <span class="merchant-amount" style="color:var(--accent)">${fmtCHF(m.total)}</span>
    </div>
  `).join('') || '<div class="empty" style="padding:20px"><span class="empty-sub">Not enough data for recurring detection</span></div>';

  // Donut: recurring vs variable
  const canvas = document.getElementById('insightsRecurringChart');
  _drawDonut(canvas, [
    { label: 'Recurring', value: recurringTotal, color: '#185fa5' },
    { label: 'Variable',  value: variableTotal,  color: '#ef9f27' },
  ], 200);

  document.getElementById('insightsRecurringLegend').innerHTML = `
    <div class="legend-item"><div class="legend-dot" style="background:#185fa5"></div>Recurring (${fmtPct(recPct)})</div>
    <div class="legend-item"><div class="legend-dot" style="background:#ef9f27"></div>Variable (${fmtPct(1-recPct)})</div>
  `;
}

/* ── Anomalies ───────────────────────────────────────────────────── */
function _renderAnomalies(expenses) {
  // Per-merchant anomalies: tx > mean + 2.5*sd
  const byMerchant = groupBy(expenses, r => r._merchant);
  const anomalies = [];

  Object.entries(byMerchant).forEach(([name, rows]) => {
    if (rows.length < 3) return; // need enough history
    const amounts = rows.map(r => r._amount);
    const m = mean(amounts), sd = stddev(amounts);
    const threshold = m + 2.5 * sd;
    rows.forEach(r => {
      if (r._amount > threshold && r._amount > m * 2) {
        anomalies.push({
          merchant: name, amount: r._amount, mean: m, sd,
          zScore: sd > 0 ? (r._amount - m) / sd : 0,
          date: `${r._year}-${String(r._month).padStart(2,'0')}-${String(r._day||1).padStart(2,'0')}`,
          cat: r._category, subcat: r._subcat,
        });
      }
    });
  });
  anomalies.sort((a,b) => b.zScore - a.zScore);

  document.getElementById('insightsAnomalyList').innerHTML = anomalies.slice(0, 12).map(a => `
    <div class="merchant-row">
      <div style="flex:1;min-width:0">
        <div class="merchant-name">${a.merchant || '(unnamed)'}</div>
        <div class="merchant-cat">${a.cat} · avg ${fmtCHF(a.mean)} · z=${a.zScore.toFixed(1)}σ</div>
      </div>
      <span class="pill pill-red" style="margin-right:8px">${a.zScore.toFixed(1)}σ</span>
      <span class="merchant-amount" style="color:var(--red)">${fmtCHF(a.amount)}</span>
    </div>
  `).join('') || '<div style="padding:14px;font-size:12px;color:var(--text3)">No significant anomalies detected</div>';

  // Spike months: months where total > mean_month + 2*sd_month
  const monthTotals = {};
  expenses.forEach(r => {
    const k = `${r._year}-${String(r._month).padStart(2,'0')}`;
    monthTotals[k] = (monthTotals[k] || 0) + r._amount;
  });
  const vals = Object.values(monthTotals);
  const mMean = mean(vals), mSd = stddev(vals);
  const spikes = Object.entries(monthTotals)
    .filter(([,v]) => v > mMean + 2 * mSd)
    .map(([k,v]) => ({ month: k, total: v, z: mSd > 0 ? (v - mMean) / mSd : 0 }))
    .sort((a,b) => b.z - a.z);

  document.getElementById('insightsSpikeList').innerHTML = spikes.slice(0, 10).map(s => `
    <div class="merchant-row">
      <div style="flex:1">
        <div class="merchant-name">${s.month}</div>
        <div class="merchant-cat">${s.z.toFixed(1)}σ above average · avg ${fmtCHF(mMean)}/mo</div>
      </div>
      <span class="pill pill-red" style="margin-right:8px">${s.z.toFixed(1)}σ</span>
      <span class="merchant-amount" style="color:var(--red)">${fmtCHF(s.total)}</span>
    </div>
  `).join('') || '<div style="padding:14px;font-size:12px;color:var(--text3)">No spike months detected</div>';
}

/* ── Calendar patterns ───────────────────────────────────────────── */
function _renderCalendarPatterns(expenses) {
  const DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Day of week — derive from serial
  const dowTotals = Array(7).fill(0);
  const dowCounts = Array(7).fill(0);
  expenses.forEach(r => {
    const serial = parseFloat(r['Date']);
    if (!isNaN(serial)) {
      const dow = Math.floor(serial + 1) % 7; // Excel day 0 = Sun offset
      dowTotals[dow] += r._amount;
      dowCounts[dow]++;
    }
  });
  const dowAvg = dowTotals.map((t, i) => dowCounts[i] > 0 ? t / dowCounts[i] : 0);

  drawBarLineChart(
    document.getElementById('insightsDowChart'),
    DOW_NAMES, dowAvg, null,
    { barColor: '#185fa5', height: 180 }
  );

  // Day of month (1–31)
  const domTotals = Array(31).fill(0);
  const domCounts = Array(31).fill(0);
  expenses.forEach(r => {
    const serial = parseFloat(r['Date']);
    if (!isNaN(serial)) {
      const d = new Date((serial - 25569) * 86400000);
      const day = d.getUTCDate() - 1; // 0-indexed
      domTotals[day] += r._amount;
      domCounts[day]++;
    }
  });
  const domAvg = domTotals.map((t, i) => domCounts[i] > 0 ? t / domCounts[i] : 0);
  const domLabels = Array.from({length:31}, (_,i) => String(i+1));

  drawBarLineChart(
    document.getElementById('insightsDomChart'),
    domLabels, domAvg, null,
    { barColor: '#3b6d11', height: 180 }
  );

  // Seasonal — avg spend per calendar month across all years in the selected period
  const monthSums = Array(12).fill(0);
  const monthYearSets = Array.from({length:12}, () => new Set());
  expenses.forEach(r => {
    if (r._month >= 1 && r._month <= 12) {
      monthSums[r._month-1] += r._amount;
      monthYearSets[r._month-1].add(r._year);
    }
  });
  const seasonAvg = monthSums.map((s, i) => monthYearSets[i].size > 0 ? s / monthYearSets[i].size : 0);

  drawBarLineChart(
    document.getElementById('insightsSeasonChart'),
    MONTHS, seasonAvg, null,
    { barColor: '#7f77dd', height: 180 }
  );

  // Month-end effect: first 5 days vs last 5 days vs days 6–25
  let startTotal=0, startN=0, endTotal=0, endN=0, midTotal=0, midN=0;
  expenses.forEach(r => {
    const serial = parseFloat(r['Date']);
    if (!isNaN(serial)) {
      const d = new Date((serial - 25569) * 86400000);
      const day = d.getUTCDate();
      // Last 5 days: need days-in-month — approximate with day >= 26
      if (day <= 5)        { startTotal += r._amount; startN++; }
      else if (day >= 26)  { endTotal   += r._amount; endN++; }
      else                 { midTotal   += r._amount; midN++; }
    }
  });
  const startAvg = startN > 0 ? startTotal/startN : 0;
  const endAvg   = endN   > 0 ? endTotal/endN     : 0;
  const midAvg   = midN   > 0 ? midTotal/midN     : 0;

  document.getElementById('insightsMonthEndList').innerHTML = `
    <div class="merchant-row">
      <div style="flex:1"><div class="merchant-name">Month-start (days 1–5)</div><div class="merchant-cat">${startN} transactions</div></div>
      <span class="merchant-amount">${fmtCHF(startAvg)} avg/tx</span>
    </div>
    <div class="merchant-row">
      <div style="flex:1"><div class="merchant-name">Mid-month (days 6–25)</div><div class="merchant-cat">${midN} transactions</div></div>
      <span class="merchant-amount">${fmtCHF(midAvg)} avg/tx</span>
    </div>
    <div class="merchant-row">
      <div style="flex:1"><div class="merchant-name">Month-end (days 26+)</div><div class="merchant-cat">${endN} transactions</div></div>
      <span class="merchant-amount">${fmtCHF(endAvg)} avg/tx</span>
    </div>
  `;

  drawBarLineChart(
    document.getElementById('insightsMonthEndChart'),
    ['Start (1–5)', 'Mid (6–25)', 'End (26+)'],
    [startAvg, midAvg, endAvg], null,
    { barColor: '#d08030', height: 140 }
  );
}

/* ── Growth table ────────────────────────────────────────────────── */
function _renderGrowthTable(allExpenses) {
  const years = S.years.slice(-4); // last 4 years for 3 YoY comparisons
  if (years.length < 2) {
    document.getElementById('insightsGrowthTable').innerHTML = '<thead></thead><tbody><tr><td style="padding:12px;color:var(--text3)">Need at least 2 years of data</td></tr></tbody>';
    return;
  }

  const cats = [...new Set(allExpenses.map(r => r._category))].sort();

  // Build YoY pairs
  const pairs = [];
  for (let i = 1; i < years.length; i++) pairs.push([years[i-1], years[i]]);

  const head = document.getElementById('insightsGrowthHead');
  head.innerHTML = '<th>Category</th>' +
    years.map(y => `<th class="num">${y}</th>`).join('') +
    pairs.map(([a,b]) => `<th class="num">${a}→${b}</th>`).join('') +
    '<th class="num">CAGR</th>';

  const body = document.getElementById('insightsGrowthBody');
  body.innerHTML = cats.map(cat => {
    const yearVals = years.map(y => sumAmount(allExpenses.filter(r => r._category === cat && r._year === y)));
    const yoyPcts  = pairs.map(([a,b], i) => {
      const va = yearVals[i], vb = yearVals[i+1];
      return va > 0 ? (vb - va) / va : null;
    });
    // CAGR from first to last year
    const first = yearVals[0], last = yearVals[yearVals.length-1];
    const n = years.length - 1;
    const cagr = first > 0 && last > 0 ? Math.pow(last/first, 1/n) - 1 : null;
    if (yearVals.every(v => v === 0)) return '';
    return `<tr>
      <td style="font-weight:600">${cat}</td>
      ${yearVals.map(v => `<td class="num">${v > 0 ? fmtCHF(v) : '—'}</td>`).join('')}
      ${yoyPcts.map(p => p === null ? '<td class="num">—</td>' :
        `<td class="num ${p > 0.1 ? 'num-neg' : p < -0.05 ? 'num-pos' : ''}">${p > 0 ? '+' : ''}${Math.round(p*100)}%</td>`).join('')}
      <td class="num ${cagr !== null && cagr > 0.05 ? 'num-neg' : cagr !== null && cagr < 0 ? 'num-pos' : ''}">${cagr !== null ? (cagr > 0 ? '+' : '') + Math.round(cagr*100) + '%' : '—'}</td>
    </tr>`;
  }).join('');
}

/* ── Donut chart helper ──────────────────────────────────────────── */
function _drawDonut(canvas, segments, H=200) {
  const { ctx, W } = prepCanvas(canvas, H);
  const cx = W/2, cy = H/2, radius = Math.min(cx, cy) - 16;
  const total = segments.reduce((s,seg) => s + seg.value, 0);
  if (!total) return;

  let startAngle = -Math.PI/2;
  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--pie-hole').trim() || '#fff';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#111';
  const text3Color = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#999';

  segments.forEach(seg => {
    const angle = (seg.value / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + angle);
    ctx.closePath(); ctx.fillStyle = seg.color; ctx.fill();
    const gapColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f5f6f8';
    ctx.strokeStyle = gapColor; ctx.lineWidth = 2; ctx.stroke();
    startAngle += angle;
  });

  // Hole
  ctx.beginPath(); ctx.arc(cx, cy, radius * 0.55, 0, Math.PI*2);
  ctx.fillStyle = bgColor; ctx.fill();

  // Centre label
  ctx.fillStyle = textColor; ctx.font = 'bold 13px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(fmtCHF(total), cx, cy - 7);
  ctx.fillStyle = text3Color; ctx.font = '10px Inter,sans-serif';
  ctx.fillText('total spend', cx, cy + 8);
}