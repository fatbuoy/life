/* ══════════════════════════════════════════════════════════════════
   FX TAB
══════════════════════════════════════════════════════════════════ */
function renderFX() {
    const year = S.fxSelectedYear || S.selectedYear;
    updateTicker(year);

  const expenses = getExpenses(S.actuals, year);
  const byCcy = groupBy(expenses, r => r._ccy);
  const totalCHF = sumAmount(expenses);

  // KPI tiles
  const ccys = Object.keys(byCcy).sort();
  document.getElementById('fxKpis').innerHTML = ccys.map(ccy => {
    const rows = byCcy[ccy];
    const chfTotal = sumAmount(rows);
    const origTotal = rows.reduce((s, r) => s + Math.abs(r._origAmount), 0);
    return `<div class="kpi">
      <div class="kpi-label"><span class="ccy-badge ccy-${ccy}">${ccy}</span></div>
      <div class="kpi-value" style="font-size:18px">${fmtCHF(chfTotal)}</div>
      <div class="kpi-sub">${fmtPct(chfTotal/totalCHF)} of spend</div>
      <div class="kpi-sub" style="margin-top:2px">Orig: ${Math.round(origTotal).toLocaleString('de-CH')} ${ccy}</div>
    </div>`;
  }).join('');

  // Pie chart (canvas)
  drawFXPieChart(byCcy, totalCHF);

  // Bar chart by month + currency
  drawFXBarChart(expenses, year);

  // Table
  const tbody = document.getElementById('fxTableBody');
  tbody.innerHTML = ccys.map(ccy => {
    const rows = byCcy[ccy];
    const chfTotal = sumAmount(rows);
    const origTotal = rows.reduce((s, r) => s + Math.abs(r._origAmount), 0);
    const avgFX = origTotal > 0 ? chfTotal / origTotal : 1;
    return `<tr>
      <td><span class="ccy-badge ccy-${ccy}">${ccy}</span></td>
      <td class="num">${Math.round(origTotal).toLocaleString('de-CH')} ${ccy}</td>
      <td class="num">${fmtCHF(chfTotal)}</td>
      <td class="num">${avgFX.toFixed(4)}</td>
      <td class="num">${fmtNum(rows.length)}</td>
      <td class="num">${fmtPct(chfTotal/totalCHF)}</td>
    </tr>`;
  }).join('');
}

function drawFXPieChart(byCcy, total) {
  const canvas = document.getElementById('fxPieChart');
  const DPR = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth || 400;
  const H = 240;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, W, H);

  const ccys = Object.keys(byCcy).sort();
  const vals = ccys.map(c => sumAmount(byCcy[c]));
  const colors = ccys.map(c => CCY_COLORS[c] || '#8899aa');

  const cx = W / 2, cy = H / 2, radius = Math.min(cx, cy) - 20;
  let startAngle = -Math.PI / 2;

  const segments = [];
  vals.forEach((v, i) => {
    const angle = (v / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    // Gap
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f5f6f8';
    ctx.strokeStyle = bgColor; ctx.lineWidth = 2; ctx.stroke();

    // Label
    const midAngle = startAngle + angle / 2;
    const lx = cx + Math.cos(midAngle) * radius * 0.65;
    const ly = cy + Math.sin(midAngle) * radius * 0.65;
    if (v / total > 0.05) {
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(10*DPR)/DPR}px Inter,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ccys[i], lx, ly - 6);
      ctx.font = `${Math.round(9*DPR)/DPR}px Inter,sans-serif`;
      ctx.fillText(fmtPct(v/total), lx, ly + 7);
    }

    segments.push({ ccy: ccys[i], val: v, color: colors[i], startAngle, endAngle });
    startAngle = endAngle;
  });

  // Donut hole
  const pieHole = getComputedStyle(document.documentElement).getPropertyValue('--pie-hole').trim() || '#ffffff';
  const pieText = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#111827';
  const pieText3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#9ca3af';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = pieHole; ctx.fill();
  ctx.fillStyle = pieText; ctx.font = `bold 13px Inter,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(fmtCHF(total), cx, cy - 7);
  ctx.fillStyle = pieText3; ctx.font = '10px Inter,sans-serif';
  ctx.fillText('Total Spend', cx, cy + 8);

  canvas.onmousemove = e => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top) * (H / rect.height);
    const dx = mx - cx, dy = my - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < radius * 0.45 || dist > radius) { hideTT(); return; }
    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI/2) angle += Math.PI * 2;
    const seg = segments.find(s => angle >= s.startAngle && angle <= s.endAngle);
    if (seg) showTT(e, seg.ccy, [{ label: 'CHF equiv', val: seg.val, color: seg.color }]);
    else hideTT();
  };
  canvas.onmouseleave = hideTT;
}

function drawFXBarChart(expenses, year) {
  const canvas = document.getElementById('fxBarChart');
  const ccys = [...new Set(expenses.map(r => r._ccy))];
  const colors = ccys.map(c => CCY_COLORS[c] || '#8899aa');

  const datasets = ccys.map((ccy, i) => ({
    label: ccy, color: colors[i],
    data: MONTHS.map((_, mi) => sumAmount(expenses.filter(r => r._ccy === ccy && r._month === mi+1))),
  }));

  drawStackedBarChart(canvas, MONTHS, datasets, { height: 240 });
}