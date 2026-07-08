/* ══════════════════════════════════════════════════════════════════
   BUDGET PLANNER TAB
══════════════════════════════════════════════════════════════════ */
const BP_KEY = 'budgetPlan';

async function _loadBudgetPlan() {
  try {
    const stored = await DB.load('budget');  // reuse budget store meta
    // Budget plan is stored separately under meta key
    const db = await DB.open();
    return new Promise(resolve => {
      const tx = db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(BP_KEY);
      req.onsuccess = e => {
        try { resolve(e.target.result ? JSON.parse(e.target.result) : {}); }
        catch { resolve({}); }
      };
      req.onerror = () => resolve({});
    });
  } catch { return {}; }
}

async function _saveBudgetPlan(plan) {
  const db = await DB.open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(JSON.stringify(plan), BP_KEY);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

function _budgetPlanKey(cat, sub) { return `${cat}||${sub}`; }

function _getSuggestedBudget(cat, sub, allExpenses, planYear) {
  // Suggested = rolling 3yr avg of (cat+sub), bumped 5% for inflation
  const rows = allExpenses.filter(r =>
    r._category === cat && r._subcat === sub && r._year < planYear && r._year >= planYear - 3
  );
  if (!rows.length) return 0;
  const years = [...new Set(rows.map(r => r._year))];
  const yearly = years.map(y => sumAmount(rows.filter(r => r._year === y)));
  return mean(yearly) * 1.05;
}

async function renderBudgetPlanner() {
  const expenses = getExpenses(S.actuals, null);

  // Populate year selector
  const planSel = document.getElementById('budgetPlanYear');
  if (planSel.options.length === 0) {
    const maxYear = Math.max(...S.years);
    for (let y = maxYear + 1; y >= maxYear - 1; y--) {
      planSel.add(new Option(y, y));
    }
    planSel.value = S.budgetPlanYear;
  }
  const planYear = parseInt(planSel.value) || S.budgetPlanYear;
  S.budgetPlanYear = planYear;
  const lastYear = planYear - 1;

  // Load saved plan
  if (!Object.keys(S.budgetPlan).length) {
    S.budgetPlan = await _loadBudgetPlan();
  }

  // Build cat/subcat list
  const lastYearExpenses = getExpenses(S.actuals, lastYear);
  const catSubMap = {};
  expenses.forEach(r => {
    const k = _budgetPlanKey(r._category, r._subcat);
    if (!catSubMap[k]) catSubMap[k] = { cat: r._category, sub: r._subcat };
  });

  const rows = Object.values(catSubMap).sort((a,b) =>
    a.cat.localeCompare(b.cat) || a.sub.localeCompare(b.sub)
  );

  let totalLastYear=0, totalSuggested=0, totalPlan=0;

  const tbody = document.getElementById('budgetPlanBody');
  let currentCat = null;
  let catLastTotal=0, catPlanTotal=0;
  const trs = [];

  rows.forEach(({cat, sub}) => {
    const k = _budgetPlanKey(cat, sub);
    const lastYrAmt = sumAmount(lastYearExpenses.filter(r => r._category===cat && r._subcat===sub));
    const suggested = _getSuggestedBudget(cat, sub, expenses, planYear);
    const planned   = S.budgetPlan[k] !== undefined ? S.budgetPlan[k] :
                      (suggested > 0 ? Math.round(suggested) : Math.round(lastYrAmt));

    totalLastYear   += lastYrAmt;
    totalSuggested  += suggested;
    totalPlan       += planned;

    const delta = lastYrAmt > 0 ? (planned - lastYrAmt) / lastYrAmt : null;
    const deltaHtml = delta === null ? '—' :
      `<span class="${delta > 0.05 ? 'num-neg' : delta < -0.02 ? 'num-pos' : ''}">${delta > 0 ? '+' : ''}${Math.round(delta*100)}%</span>`;

    trs.push(`<tr>
      <td style="font-weight:600;color:var(--text2)">${cat}</td>
      <td>${sub || '(unset)'}</td>
      <td class="num">${lastYrAmt > 0 ? fmtCHF(lastYrAmt) : '—'}</td>
      <td class="num" style="color:var(--text3)">${suggested > 0 ? fmtCHF(suggested) : '—'}</td>
      <td class="num" style="color:var(--text3)">${suggested > 0 ? fmtCHF(suggested) : fmtCHF(lastYrAmt)}</td>
      <td class="num">
        <input type="number" value="${Math.round(planned)}"
          data-key="${k.replace(/"/g,'&quot;')}"
          style="width:110px;background:var(--surface2);border:1px solid var(--border2);border-radius:4px;
                 padding:3px 6px;font-size:12px;color:var(--text);text-align:right;font-family:inherit"
          onchange="updateBudgetPlanCell(this)"
          onfocus="this.select()">
      </td>
      <td class="num">${deltaHtml}</td>
    </tr>`);
  });

  tbody.innerHTML = trs.join('');

  // Footer
  const totalDelta = totalLastYear > 0 ? (totalPlan - totalLastYear) / totalLastYear : null;
  document.getElementById('budgetPlanFoot').innerHTML = `<tr>
    <td colspan="2">Total</td>
    <td class="num">${fmtCHF(totalLastYear)}</td>
    <td class="num">${fmtCHF(totalSuggested)}</td>
    <td class="num">${fmtCHF(totalSuggested)}</td>
    <td class="num" style="font-size:14px;color:var(--accent)">${fmtCHF(totalPlan)}</td>
    <td class="num">${totalDelta !== null ? (totalDelta>0?'+':'')+Math.round(totalDelta*100)+'%' : '—'}</td>
  </tr>`;

  // KPI tiles
  document.getElementById('budgetPlanKpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-label">Plan Total ${planYear}</div>
      <div class="kpi-value" style="color:var(--accent)">${fmtCHF(totalPlan)}</div>
      <div class="kpi-sub">Your planned budget</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Last Year (${lastYear})</div>
      <div class="kpi-value" style="font-size:18px">${fmtCHF(totalLastYear)}</div>
      <div class="kpi-sub">Actual spend</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">3yr Avg Suggested</div>
      <div class="kpi-value" style="font-size:18px;color:var(--text2)">${fmtCHF(totalSuggested)}</div>
      <div class="kpi-sub">+5% inflation uplift</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">vs Last Year</div>
      <div class="kpi-value" style="font-size:20px;color:${totalPlan > totalLastYear ? 'var(--red)' : 'var(--green)'}">
        ${totalLastYear > 0 ? (totalPlan>totalLastYear?'+':'') + Math.round((totalPlan-totalLastYear)/totalLastYear*100)+'%' : '—'}
      </div>
      <div class="kpi-sub">${fmtCHF(Math.abs(totalPlan - totalLastYear))} ${totalPlan > totalLastYear ? 'more' : 'less'}</div>
    </div>
  `;

  // Monthly distribution chart (apply historical monthly weights to plan total)
  _drawBudgetMonthlyChart(expenses, totalPlan, lastYear);
}

function updateBudgetPlanCell(input) {
  const key = input.getAttribute('data-key');
  const val = parseFloat(input.value) || 0;
  S.budgetPlan[key] = val;
  // Debounced auto-save
  clearTimeout(S._bpSaveTimer);
  S._bpSaveTimer = setTimeout(() => _saveBudgetPlan(S.budgetPlan), 800);
  // Refresh KPIs
  renderBudgetPlanner();
}

async function saveBudgetPlan() {
  await _saveBudgetPlan(S.budgetPlan);
  _syncToast('💾 Budget plan saved', 'success');
}

function resetBudgetPlan() {
  if (!confirm('Reset all budget values to actuals-based suggestions?')) return;
  S.budgetPlan = {};
  renderBudgetPlanner();
}

function exportBudgetPlanCSV() {
  const planYear = S.budgetPlanYear;
  const expenses = getExpenses(S.actuals, null);
  const catSubMap = {};
  expenses.forEach(r => {
    const k = _budgetPlanKey(r._category, r._subcat);
    if (!catSubMap[k]) catSubMap[k] = { cat: r._category, sub: r._subcat };
  });

  const rows = [['Category','Sub-Category','Budget Amount','Year']];
  Object.values(catSubMap).sort((a,b)=>a.cat.localeCompare(b.cat)||a.sub.localeCompare(b.sub)).forEach(({cat,sub}) => {
    const k = _budgetPlanKey(cat, sub);
    const lastYrAmt = sumAmount(getExpenses(S.actuals, planYear-1).filter(r=>r._category===cat&&r._subcat===sub));
    const suggested = _getSuggestedBudget(cat, sub, expenses, planYear);
    const planned = S.budgetPlan[k] !== undefined ? S.budgetPlan[k] : (suggested > 0 ? Math.round(suggested) : Math.round(lastYrAmt));
    if (planned > 0) rows.push([cat, sub, planned, planYear]);
  });

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `budget-plan-${planYear}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function _drawBudgetMonthlyChart(expenses, planTotal, lastYear) {
  // Use last year's monthly weights to distribute plan total
  const lastYrExp = expenses.filter(r => r._year === lastYear);
  const lastYrMonthly = Array(12).fill(0);
  lastYrExp.forEach(r => { if (r._month>=1&&r._month<=12) lastYrMonthly[r._month-1] += r._amount; });
  const lastYrTotal = lastYrMonthly.reduce((s,v)=>s+v,0);

  const planMonthly = lastYrTotal > 0
    ? lastYrMonthly.map(v => v / lastYrTotal * planTotal)
    : Array(12).fill(planTotal / 12);

  drawBarLineChart(
    document.getElementById('budgetPlanChart'),
    MONTHS, planMonthly, null,
    { barColor: '#185fa5', height: 200 }
  );
}

/* Expose _syncToast for saveBudgetPlan toast */
function _syncToast(message, type='info') {
  document.getElementById('_syncToast')?.remove();
  if (!document.getElementById('_syncToastStyle')) {
    const s = document.createElement('style'); s.id='_syncToastStyle';
    s.textContent=`@keyframes _stIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes _stOut{from{opacity:1}to{opacity:0}}`;
    document.head.appendChild(s);
  }
  const cols = { success:{bg:'#162a16',border:'#3b6d11'}, error:{bg:'#2a1616',border:'#c0392b'}, info:{bg:'#0c1a2a',border:'#185fa5'} };
  const {bg,border} = cols[type]||cols.info;
  const el = document.createElement('div'); el.id='_syncToast';
  el.style.cssText=`position:fixed;bottom:20px;right:16px;z-index:99999;background:${bg};border:1px solid ${border};border-radius:10px;padding:10px 14px;font-size:12px;color:#fff;font-family:Inter,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.45);animation:_stIn .2s ease forwards`;
  el.innerHTML=`<div style="font-weight:600">${message}</div>`;
  document.body.appendChild(el);
  setTimeout(()=>{el.style.animation='_stOut .3s ease forwards';},2500);
  setTimeout(()=>el.remove(),2820);
}