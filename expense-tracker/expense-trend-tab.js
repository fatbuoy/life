/* ══════════════════════════════════════════════════════════════════
   TREND TAB
══════════════════════════════════════════════════════════════════ */
let _trendCat     = '';
let _trendGroupBy = 'annual';

function renderTrend() {
  updateTicker(null);

  renderPillFilter('trendCatFilter', S._catOptions, _trendCat, v => {
    _trendCat = v; renderTrend();
  });

  renderPillFilter('trendGroupBy', [
    { value: 'annual',  label: 'Annual' },
    { value: 'monthly', label: 'Monthly (all years)' },
  ], _trendGroupBy, v => {
    _trendGroupBy = v; renderTrend();
  });

  const expenses = getExpenses(S.actuals, null);

  if (_trendGroupBy === 'annual') {
    renderAnnualTrend(expenses, _trendCat);
  } else {
    renderMonthlyMultiYearTrend(expenses, _trendCat);
  }
}

function renderAnnualTrend(expenses, catFilter) {
  const years = S.years;

  // Determine categories to show
  let cats;
  if (catFilter) {
    cats = [catFilter];
  } else {
    // Top 8 categories by total
    cats = Object.entries(groupBy(expenses, r => r._category))
      .map(([k, v]) => ({ cat: k, total: sumAmount(v) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8).map(c => c.cat);
  }

  // Build datasets: one dataset per category, values per year
  const datasets = cats.map((cat, i) => ({
    label: cat,
    color: CAT_COLORS[i % CAT_COLORS.length],
    data: years.map(y => sumAmount(expenses.filter(r => r._category === cat && r._year === y))),
  }));

  // Legend
  const legendEl = document.getElementById('trendLegend');
  legendEl.innerHTML = datasets.map(d => `
    <div class="legend-item" style="opacity:${S.hiddenSeries.has(d.label)?0.3:1}" onclick="toggleTrendSeries('${d.label.replace(/'/g,"\\'")}')">
      <div class="legend-dot" style="background:${d.color}"></div>${d.label}
    </div>
  `).join('');

  const visDatasets = datasets.filter(d => !S.hiddenSeries.has(d.label));
  const canvas = document.getElementById('trendChart');
  drawMultiLineChart(canvas, years.map(String), visDatasets, { height: 300 });

  // Table
  buildTrendTable(years, cats, expenses);
}

function renderMonthlyMultiYearTrend(expenses, catFilter) {
  const years = S.years.slice(-5); // last 5 years
  const labels = MONTHS;

  let filtered = catFilter ? expenses.filter(r => r._category === catFilter) : expenses;

  const datasets = years.map((y, i) => ({
    label: String(y),
    color: CAT_COLORS[i % CAT_COLORS.length],
    data: MONTHS.map((_, mi) => sumAmount(filtered.filter(r => r._year === y && r._month === mi+1))),
  }));

  const legendEl = document.getElementById('trendLegend');
  legendEl.innerHTML = datasets.map(d => `
    <div class="legend-item" style="opacity:${S.hiddenSeries.has(d.label)?0.3:1}" onclick="toggleTrendSeries('${d.label}')">
      <div class="legend-dot" style="background:${d.color}"></div>${d.label}
    </div>
  `).join('');

  const visDatasets = datasets.filter(d => !S.hiddenSeries.has(d.label));
  const canvas = document.getElementById('trendChart');
  drawMultiLineChart(canvas, labels, visDatasets, { height: 300 });

  // Simple annual table
  const cats = catFilter ? [catFilter] :
    Object.entries(groupBy(expenses, r => r._category))
      .map(([k,v]) => ({cat:k,total:sumAmount(v)}))
      .sort((a,b)=>b.total-a.total).slice(0,8).map(c=>c.cat);
  buildTrendTable(S.years, cats, expenses);
}

function toggleTrendSeries(label) {
  if (S.hiddenSeries.has(label)) S.hiddenSeries.delete(label);
  else S.hiddenSeries.add(label);
  renderTrend();
}

function buildTrendTable(years, cats, expenses) {
  const head = document.getElementById('trendTableHead');
  const body = document.getElementById('trendTableBody');
  const foot = document.getElementById('trendTableFoot');

  head.innerHTML = '<th>Category</th>' + years.map(y => `<th class="num">${y}</th>`).join('') + '<th class="num">Total</th>';

  const yearTotals = years.map(() => 0);
  let grandTotal = 0;

  body.innerHTML = cats.map((cat, ci) => {
    const vals = years.map(y => sumAmount(expenses.filter(r => r._category === cat && r._year === y)));
    const total = vals.reduce((s, v) => s + v, 0);
    vals.forEach((v, i) => yearTotals[i] += v);
    grandTotal += total;
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:6px">
        <div class="cat-dot" style="background:${CAT_COLORS[ci%CAT_COLORS.length]}"></div>${cat}
      </div></td>
      ${vals.map(v => `<td class="num">${v > 0 ? fmtCHF(v) : '—'}</td>`).join('')}
      <td class="num" style="color:var(--accent)">${fmtCHF(total)}</td>
    </tr>`;
  }).join('');

  foot.innerHTML = `<tr>
    <td>Total</td>
    ${yearTotals.map(v => `<td class="num">${fmtCHF(v)}</td>`).join('')}
    <td class="num">${fmtCHF(grandTotal)}</td>
  </tr>`;
}