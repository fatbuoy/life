/* ══════════════════════════════════════════════════════════════════
   MERCHANTS TAB
══════════════════════════════════════════════════════════════════ */

let _merchantCat   = '';
let _merchantLimit = 25;

function renderMerchants() {
  const year = S.merchantSelectedYear || S.selectedYear;
  updateTicker(year);

  // Category pills
  renderPillFilter('merchantCatFilter', S._catOptions, _merchantCat, v => {
    _merchantCat = v; renderMerchants();
  });

  // Limit pills (static options)
  renderPillFilter('merchantLimit', [
    { value: 25,  label: 'Top 25' },
    { value: 50,  label: 'Top 50' },
    { value: 100, label: 'Top 100' },
    { value: 0,   label: 'All' },
  ], _merchantLimit, v => {
    _merchantLimit = v; renderMerchants();
  });

  const search = document.getElementById('merchantSearch').value.toLowerCase();

  let expenses = getExpenses(S.actuals, year);
  if (_merchantCat) expenses = expenses.filter(r => r._category === _merchantCat);
  if (search)       expenses = expenses.filter(r => r._merchant.toLowerCase().includes(search));

  const merchantTotals = Object.entries(groupBy(expenses, r => r._merchant))
    .map(([name, rows]) => ({
      name, amount: sumAmount(rows), count: rows.length,
      cat: rows[0]?._category || '—',
      subcat: rows[0]?._subcat || '',
    }))
    .sort((a, b) => b.amount - a.amount);

  const total = merchantTotals.reduce((s, m) => s + m.amount, 0);
  const shown = _merchantLimit ? merchantTotals.slice(0, _merchantLimit) : merchantTotals;

  document.getElementById('merchantTitle').textContent =
    `Top Merchants · ${fmtNum(shown.length)} shown · ${fmtCHF(total)} total`;

  const maxAmt = shown[0]?.amount || 1;

  document.getElementById('merchantList').innerHTML = shown.map((m, i) => `
    <div class="merchant-row">
      <span class="merchant-rank">${i+1}</span>
      <div class="cat-row-bar"><span style="width:${(m.amount/maxAmt*100).toFixed(1)}%;background:${CAT_COLORS[i % CAT_COLORS.length]}"></span></div>
      <div style="flex:1;min-width:0">
        <div class="merchant-name">${m.name || '(unnamed)'}</div>
        <div class="merchant-cat">${m.cat}${m.subcat ? ' · ' + m.subcat : ''}</div>
      </div>
      <span class="merchant-count">${m.count}×</span>
      <span class="merchant-amount">${fmtCHF(m.amount)}</span>
    </div>
  `).join('');
}