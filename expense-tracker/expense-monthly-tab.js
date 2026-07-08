/* ══════════════════════════════════════════════════════════════════
   MONTHLY TAB
══════════════════════════════════════════════════════════════════ */
let _monthlyCat = '';

function renderMonthly() {
  const year = S.monthlySelectedYear;
  updateTicker(year);

  renderPillFilter('monthlyCatFilter', S._catOptions, _monthlyCat, v => {
    _monthlyCat = v; renderMonthly();
  });

  let expenses = getExpenses(S.actuals, year);
  if (_monthlyCat) expenses = expenses.filter(r => r._category === _monthlyCat);

  const byMonth = Array(12).fill(0);
  expenses.forEach(r => { if(r._month >= 1 && r._month <= 12) byMonth[r._month-1] += r._amount; });

  const budget = getBudget(year);
  const budFiltered = _monthlyCat ? budget.filter(r => r._category === _monthlyCat) : budget;
  const budByMonth = Array(12).fill(0);
  budFiltered.forEach(r => { if(r._month >= 1 && r._month <= 12) budByMonth[r._month-1] += r._amount; });

  const hasBudget = budget.length > 0;

  const legendEl = document.getElementById('monthlyLegend');
  legendEl.innerHTML = `
    <div class="legend-item"><div class="legend-dot" style="background:#185fa5"></div>Actual Spend</div>
    ${hasBudget ? '<div class="legend-item"><div class="legend-line" style="background:#ef9f27;height:2px;border-top:2px dashed #ef9f27"></div>Budget</div>' : ''}
  `;

  const canvas = document.getElementById('monthlyChart');
  drawBarLineChart(canvas, MONTHS, byMonth, hasBudget ? budByMonth : null,
    { barColor:'#185fa5', lineColor:'#ef9f27', height:280 });

  buildMonthlyTable(byMonth, budByMonth, hasBudget);

  }
function buildMonthlyTable(actuals, budgets, hasBudget) {
  const head = document.getElementById('monthlyTableHead');
  const body = document.getElementById('monthlyTableBody');
  const foot = document.getElementById('monthlyTableFoot');

  head.innerHTML = `<th>Month</th><th class="num">Actual</th>` +
    (hasBudget ? `<th class="num">Budget</th><th class="num">Variance</th><th class="num">%</th>` : '');

  let totalAct = 0, totalBud = 0;
  body.innerHTML = MONTHS.map((m, i) => {
    const act = actuals[i]; const bud = budgets[i];
    totalAct += act; if (hasBudget) totalBud += bud;
    const vari = hasBudget ? bud - act : 0;
    const pct = hasBudget && bud > 0 ? act/bud : null;
    return `<tr>
      <td>${m}</td>
      <td class="num">${act > 0 ? fmtCHF(act) : '—'}</td>
      ${hasBudget ? `
        <td class="num">${bud > 0 ? fmtCHF(bud) : '—'}</td>
        <td class="num ${vari >= 0 ? 'num-pos' : 'num-neg'}">${bud > 0 || act > 0 ? fmtCHF(Math.abs(vari)) : '—'}</td>
        <td class="num ${pct != null ? (pct > 1 ? 'num-neg' : 'num-pos') : ''}">${pct != null ? fmtPct(pct) : '—'}</td>
      ` : ''}
    </tr>`;
  }).join('');

  const totalVari = totalBud - totalAct;
  foot.innerHTML = `<tr>
    <td>Total</td>
    <td class="num">${fmtCHF(totalAct)}</td>
    ${hasBudget ? `
      <td class="num">${fmtCHF(totalBud)}</td>
      <td class="num ${totalVari >= 0 ? 'num-pos' : 'num-neg'}">${fmtCHF(Math.abs(totalVari))}</td>
      <td class="num">${totalBud > 0 ? fmtPct(totalAct/totalBud) : '—'}</td>
    ` : ''}
  </tr>`;
}
