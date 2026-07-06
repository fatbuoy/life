/**
 * SAHANI SUITE — travel-planner: adventure.js
 * Bespoke stage-list module for trip type 'adventure' (treks,
 * bikepacking): trek hero stats, stage list/filter, stage edit form.
 * Depends on: core.js (constants, notesGroupHtml, removeItemFooterHtml,
 * toggleFieldVisibility, commitItinerary, getIconifyTag) and itinerary.js
 * (buildJourneyCardMarkup, for transit cards mixed into the timeline).
 */
'use strict';

function getTrekStages(trip) {
  if (!trip || trip.type !== 'adventure' || !Array.isArray(trip.itinerary)) return null;
  const stages = trip.itinerary.filter(i => i.hasOwnProperty('distance_km'));
  return stages.length ? stages : null;
}

function getTrekTransitItems(trip) {
  if (!trip || trip.type !== 'adventure' || !Array.isArray(trip.itinerary)) return null;
  return trip.itinerary.filter(i => i.type === 'transit');
}

/* Stages + transit legs merged and sorted by date, for the timeline view
   only. Hero stats in renderTrekSheet stay stage-only (getTrekStages),
   since transit items don't carry distance/ascent/descent. */
function getTrekTimeline(trip) {
  const stages = getTrekStages(trip) || [];
  const transits = getTrekTransitItems(trip) || [];
  if (!stages.length && !transits.length) return null;
  return [...stages, ...transits].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}


/* ── REUSABLE MULTI-DAY TREK STAGE MODAL ──
   Renders a bespoke stage-list view for any trip with type
   "adventure", reading stage data straight from that trip's
   itinerary array in travel.json (distance_km/ascent_m/descent_m/
   moving_time/breaks/start_time/finish_time/suggested_accommodation/
   booking_priority/stage_number fields). Reusable as-is for future
   hikes or bikepacking trips — just set type to "adventure" and
   populate the same itinerary fields. */
function renderTrekSheet() {
  const sheet = document.getElementById('iosSheet');
  const stages = getTrekStages(currentTrip) || [];

  const totalKm = stages.reduce((s, x) => s + (parseFloat(x.distance_km) || 0), 0);
  const totalAsc = stages.reduce((s, x) => s + (parseFloat(x.ascent_m) || 0), 0);
  const totalDesc = stages.reduce((s, x) => s + (parseFloat(x.descent_m) || 0), 0);
  const movingDays = stages.filter(x => (parseFloat(x.distance_km) || 0) > 0).length;
  const hasCritical = stages.some(x => x.booking_priority === 'Critical');
  const hasHigh = stages.some(x => x.booking_priority === 'High');
  if ((trekStageFilter === 'Critical' && !hasCritical) || (trekStageFilter === 'High' && !hasHigh)) {
    trekStageFilter = 'all';
  }

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="closeSheet()">Close</button>
      <div class="ios-nav-title">${currentTrip.title || currentTrip.destination || 'Trip Details'}</div>
      <button class="ios-link-btn bold" onclick="openTripForm('${currentTrip.id}')">Edit</button>
    </div>

    <div class="trek-hero">
      <div class="trek-hero-eyebrow">${(TYPE_META[currentTrip.type]?.label || currentTrip.type || 'Trek').toUpperCase()}</div>
      <div class="trek-hero-title">${currentTrip.title || currentTrip.destination}</div>
      <div class="trek-hero-sub">${fmtDate(currentTrip.startDate)} — ${fmtDate(currentTrip.endDate)} · ${movingDays} stage${movingDays===1?'':'s'}</div>
      <div class="trek-stats-bar">
        <div class="trek-stat">
          <div class="trek-stat-val">${totalKm}</div>
          <div class="trek-stat-lbl">km total</div>
        </div>
        <div class="trek-stat">
          <div class="trek-stat-val" style="color:#7fffa0;">+${totalAsc.toLocaleString()}</div>
          <div class="trek-stat-lbl">m ascent</div>
        </div>
        <div class="trek-stat">
          <div class="trek-stat-val" style="color:#ff9d8a;">-${totalDesc.toLocaleString()}</div>
          <div class="trek-stat-lbl">m descent</div>
        </div>
      <div class="trek-stat">
          <div class="trek-stat-val">${stages.length}</div>
          <div class="trek-stat-lbl">days</div>
        </div>
      </div>
      ${currentTrip.packingList ? `
      <div class="trek-packing-row">
        <a class="trek-packing-btn" href="/${currentTrip.packingList}" target="_blank">
          🎒 Packing List
          <span class="trek-packing-arrow">→</span>
        </a>
      </div>` : ''}
    </div>

    <div class="trek-filter-bar">
      <button class="trek-filter-pill ${trekStageFilter==='all'?'active':''}" onclick="setTrekFilter('all')">All Stages</button>
      ${hasCritical ? `<button class="trek-filter-pill ${trekStageFilter==='Critical'?'active':''}" onclick="setTrekFilter('Critical')">🔴 Critical Booking</button>` : ''}
      ${hasHigh ? `<button class="trek-filter-pill ${trekStageFilter==='High'?'active':''}" onclick="setTrekFilter('High')">🟠 High Priority</button>` : ''}
      <button class="trek-filter-pill ${trekStageFilter==='rest'?'active':''}" onclick="setTrekFilter('rest')">Rest &amp; Travel</button>
      <button class="trek-filter-pill" style="background:#0f4c2a; color:#fff; border-color:#0f4c2a;" onclick="openStageForm(-1)">+ Add Stage</button>
      <button class="trek-filter-pill" style="background:#007aff; color:#fff; border-color:#007aff;" onclick="openJourneyForm(-1, true)">+ Add Transit</button>
    </div>

    <div class="ios-sheet-body" id="subTabContent" style="padding:0;"></div>
  `;

  document.getElementById('iosOverlay').style.display = 'flex';
  renderTrekStageList();
}

function setTrekFilter(filter) {
  trekStageFilter = filter;
  document.querySelectorAll('.trek-filter-pill').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderTrekStageList();
}

function renderTrekStageList() {
  const container = document.getElementById('subTabContent');
  const stages = getTrekTimeline(currentTrip) || [];

  if (stages.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:50px 20px;">
      ${getIconifyTag('mdi:map-marker-path', 36, '#c7c7cc')}
      <p style="color:#8e8e93; margin-top:10px; font-size:14px;">No stages added yet.<br>Tap "+ Add Stage" above to build your trek day by day.</p>
    </div>`;
    return;
  }

  let filtered = stages;
  if (trekStageFilter === 'Critical' || trekStageFilter === 'High') {
    filtered = stages.filter(s => s.booking_priority === trekStageFilter);
  } else if (trekStageFilter === 'rest') {
    filtered = stages.filter(s => s.type !== 'transit' && (parseFloat(s.distance_km) || 0) === 0);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:#8e8e93; margin-top:40px; font-size:14px;">No stages match this filter.</p>`;
    return;
  }

  container.innerHTML = `<div class="trek-stage-list">` + filtered.map(s => {
    if (s.type === 'transit') return buildJourneyCardMarkup(s);

    const realIdx = currentTrip.itinerary.indexOf(s);
    const km = parseFloat(s.distance_km) || 0;
    const asc = parseFloat(s.ascent_m) || 0;
    const desc = parseFloat(s.descent_m) || 0;
    const stageLabel = String(s.stage_number || '').toLowerCase();
    const isRest = stageLabel === 'rest';
    const isTravel = stageLabel === 'travel';
    const badgeBg = isRest ? '#f2f2f7' : isTravel ? '#e5f1ff' : '#0f4c2a';
    const badgeColor = isRest ? '#636366' : isTravel ? '#0055cc' : '#fff';
    const badgeLabel = isRest ? 'R' : isTravel ? '✈' : (s.stage_number || '');
    const priority = s.booking_priority || 'Low';
    const isBooked = priority === 'Booked';
    const prColour = TREK_PRIORITY_COLOUR[priority] || '#8e8e93';
    const maxBar = Math.max(asc, desc, 1);
    const route = s.location || s.title || '';

    return `
    <div class="trek-stage-card" id="day-${s.date || 'stage-' + realIdx}">
      <div class="trek-stage-summary" onclick="toggleTrekStage(this)">
        <div class="trek-stage-badge" style="background:${badgeBg}; color:${badgeColor};">${badgeLabel}</div>
        <div class="trek-stage-mid">
          <div class="trek-stage-route">${route}</div>
          <div class="trek-stage-date">${fmtDate(s.date)}${km>0 ? ' · ' + (s.start_time||'') + '–' + (s.finish_time||'') : ''}</div>
          ${km > 0 ? `
            <div class="trek-stage-chips">
              <span class="trek-chip trek-chip-dist">${km} km</span>
              <span class="trek-chip trek-chip-asc">▲ ${asc}m</span>
              <span class="trek-chip trek-chip-desc">▼ ${desc}m</span>
              <span class="trek-chip trek-chip-time">${s.moving_time||''}</span>
            </div>
            <div class="trek-elev-bar">
              <div class="trek-elev-asc" style="width:${(asc/maxBar*50)}%;"></div>
              <div class="trek-elev-desc" style="width:${(desc/maxBar*50)}%;"></div>
            </div>
          ` : ''}
        </div>
        <div class="trek-priority-dot" style="background:${prColour};" title="${priority} booking priority"></div>
        <div class="expand-chevron" style="align-self:center; transition: transform 0.2s; flex-shrink:0;">${getIconifyTag('mdi:chevron-down', 18, '#c7c7cc')}</div>
      </div>
      <div class="trek-stage-detail" style="display:none;">
        <div class="trek-detail-grid">
          <div class="trek-detail-cell">
            <div class="trek-detail-lbl">Moving Time</div>
            <div class="trek-detail-val">${s.moving_time || '—'}</div>
          </div>
          <div class="trek-detail-cell">
            <div class="trek-detail-lbl">Breaks</div>
            <div class="trek-detail-val">${s.breaks || '—'}</div>
          </div>
        </div>
        ${s.route_map ? `<div style="margin:8px 0;"><a href="${s.route_map}" target="_blank" rel="noopener" style="font-size:11px; font-weight:600; color:#007aff; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">${getIconifyTag('mdi:map-outline', 13, '#007aff')} View Route Map</a></div>` : ''}
        <div class="trek-accom-row">
          ${getIconifyTag('mdi:bed-outline', 16, '#5856d6')}
          <div class="trek-accom-name">
            ${s.suggested_accommodation || '—'}
            ${isBooked && s.details?.phone ? `<div style="font-size:11px; color:#8e8e93; font-weight:500; margin-top:1px;"><a href="${telHref(s.details.phone)}" style="color:#007aff; text-decoration:none;">${s.details.phone}</a>${s.details?.confirmationRef ? ' · Ref: ' + s.details.confirmationRef : ''}</div>` : ''}
            ${isBooked && s.details?.address ? `<div style="font-size:11px; color:#8e8e93; font-weight:500;"><a href="${mapsHref(s.details.address)}" target="_blank" rel="noopener" style="color:#007aff; text-decoration:none;">${s.details.address}</a></div>` : ''}
            ${isBooked && s.details?.refundable ? `<div style="font-size:10px; color:#15803d; font-weight:600; margin-top:2px;">✓ Refundable</div>` : ''}
          </div>
          <div class="trek-priority-badge" style="background:${prColour}20; color:${prColour};">${isBooked ? '✓ Booked' : priority}</div>
        </div>
        ${s.notes ? `<div class="trek-notes-box">${s.notes}</div>` : ''}
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="trek-filter-pill" style="flex:1; text-align:center; background:#fff;" onclick="openStageForm(${realIdx})">${getIconifyTag('mdi:pencil-outline', 13, '#3a3a3c')} Edit Stage</button>
          ${!isBooked ? `<button class="trek-filter-pill" style="flex:1; text-align:center; background:#e2fbe8; color:#15803d; border-color:#bbf0c9;" onclick="openStageForm(${realIdx}, true)">${getIconifyTag('mdi:check-circle-outline', 13, '#15803d')} Mark Booked</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('') + `</div>`;
  scrollToToday(container);
}

function toggleTrekStage(summaryEl) {
  const detailsEl = summaryEl.nextElementSibling;
  const chevron = summaryEl.querySelector('.expand-chevron');
  const isHidden = detailsEl.style.display === 'none';
  detailsEl.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    chevron.querySelector('iconify-icon').setAttribute('icon', 'mdi:chevron-up');
  } else {
    chevron.querySelector('iconify-icon').setAttribute('icon', 'mdi:chevron-down');
  }
}

/* ── STAGE EDIT FORM ──
   Edits a single itinerary item for adventure trips, using the
   trek-specific fields (distance_km/ascent_m/descent_m/moving_time/
   breaks/start_time/finish_time/suggested_accommodation/
   booking_priority/stage_number). jumpToBooked=true opens straight
   into the booked state so "Mark Booked" can capture contact info
   in one step. */
function openStageForm(index, jumpToBooked = false) {
  const sheet = document.getElementById('iosSheet');
  const isNew = index === -1;
  const stages = currentTrip.itinerary || [];
  const nextStageNum = isNew ? (stages.filter(s => !isNaN(parseInt(s.stage_number))).length + 1) : null;

  const item = isNew ? {
    id: 'it-' + Date.now(), type: 'activity', status: 'not-booked',
    title: '', date: currentTrip.startDate || '', location: '',
    stage_number: String(nextStageNum), distance_km: '', ascent_m: '', descent_m: '',
    moving_time: '', breaks: '', start_time: '', finish_time: '', route_map: '',
    suggested_accommodation: '', booking_priority: 'Low', notes: '', details: {}
  } : stages[index];

  const priority = jumpToBooked ? 'Booked' : (item.booking_priority || 'Low');
  const isBooked = priority === 'Booked';

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="openTripSheet('${currentTrip.id}')">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Stage' : 'Edit Stage'}</div>
      <button class="ios-link-btn bold" onclick="saveStageLevel(${index})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Stage</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Stage # (or Rest/Travel)</label>
          <input type="text" id="stgNumber" class="ios-input" placeholder="1, Rest, Travel" value="${item.stage_number || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Route / Title</label>
          <input type="text" id="stgRoute" class="ios-input" placeholder="Gaflei → Sargans" value="${item.location || item.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Date</label>
          <input type="date" id="stgDate" class="ios-input" value="${item.date || ''}">
        </div>
      </div>

      <div class="ios-group-title">Trail Metrics</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Distance (km)</label>
          <input type="number" step="0.1" id="stgDistance" class="ios-input" placeholder="e.g. 22" value="${item.distance_km || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Ascent (m)</label>
          <input type="number" id="stgAscent" class="ios-input" placeholder="e.g. 1200" value="${item.ascent_m || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Descent (m)</label>
          <input type="number" id="stgDescent" class="ios-input" placeholder="e.g. 800" value="${item.descent_m || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Moving Time</label>
          <input type="text" id="stgMoving" class="ios-input" placeholder="e.g. 6.8 h" value="${item.moving_time || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Breaks</label>
          <input type="text" id="stgBreaks" class="ios-input" placeholder="e.g. 2.0 h" value="${item.breaks || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Start Time</label>
          <input type="text" id="stgStart" class="ios-input" placeholder="e.g. 08:00" value="${item.start_time || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Finish Time</label>
          <input type="text" id="stgFinish" class="ios-input" placeholder="e.g. 16:30" value="${item.finish_time || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Route Map URL</label>
          <input type="url" id="stgRouteMap" class="ios-input" placeholder="https://..." value="${item.route_map || ''}">
        </div>
      </div>

      <div class="ios-group-title">Accommodation &amp; Booking</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Accommodation</label>
          <input type="text" id="stgAccom" class="ios-input" placeholder="Hotel / hut name" value="${item.suggested_accommodation || ''}">
        </div>
        <div class="ios-row ios-row-between">
          <label class="ios-label">Mark as Booked</label>
          <label class="ios-switch">
            <input type="checkbox" id="stgIsBooked" ${isBooked ? 'checked' : ''} onchange="toggleFieldVisibility(this, ['stgBookedFields','block'], ['rowStgPriority','none','flex'])">
            <span class="ios-slider"></span>
          </label>
        </div>
        <div class="ios-row" id="rowStgPriority" style="display:${isBooked ? 'none' : 'flex'};">
          <label class="ios-label">Booking Priority</label>
          <select id="stgPriority" class="ios-select">
            <option value="Critical" ${priority==='Critical'?'selected':''}>Critical</option>
            <option value="High" ${priority==='High'?'selected':''}>High</option>
            <option value="Medium" ${priority==='Medium'?'selected':''}>Medium</option>
            <option value="Low" ${priority==='Low'?'selected':''}>Low</option>
          </select>
        </div>
      </div>

      <div id="stgBookedFields" style="display:${isBooked ? 'block' : 'none'};">
        <div class="ios-group-title">Booking Details</div>
        <div class="ios-group">
          <div class="ios-row">
            <label class="ios-label">Phone Number</label>
            <input type="text" id="stgPhone" class="ios-input" placeholder="+41 ..." value="${item.details?.phone || ''}">
          </div>
          <div class="ios-row">
            <label class="ios-label">Address</label>
            <input type="text" id="stgAddress" class="ios-input" placeholder="Street, town" value="${item.details?.address || ''}">
          </div>
          <div class="ios-row">
            <label class="ios-label">Confirmation Ref</label>
            <input type="text" id="stgConfRef" class="ios-input" placeholder="Booking reference" value="${item.details?.confirmationRef || ''}">
          </div>
          <div class="ios-row ios-row-between">
            <label class="ios-label">Refundable</label>
            <label class="ios-switch">
              <input type="checkbox" id="stgRefundable" ${item.details?.refundable ? 'checked' : ''}>
              <span class="ios-slider"></span>
            </label>
          </div>
        </div>
      </div>

      ${notesGroupHtml('Route Notes', 'stgNotes', 'Pass conditions, lunch stops, cable cars...', item.notes)}

      ${removeItemFooterHtml(index, isNew, 'deleteStageRaw', 'Remove Stage')}
    </div>
  `;

  document.getElementById('iosOverlay').style.display = 'flex';
}

/* ── GENERIC SHOW/HIDE TOGGLE ──
   Flips one or more elements' display based on a checkbox's checked
   state. Pass [elementId, displayWhenChecked, displayWhenUnchecked?]
   tuples — displayWhenUnchecked defaults to 'none'. Replaces the old
   toggleFoodReservationFields / toggleSightseeingBookingFields /
   toggleStageBookedFields, which were all the same one-or-two-element
   show/hide with different ids baked in. */

function saveStageLevel(index) {
  const isNew = index === -1;
  const isBooked = document.getElementById('stgIsBooked').checked;
  const route = document.getElementById('stgRoute').value;

  const stage = {
    id: isNew ? 'it-' + Date.now() : currentTrip.itinerary[index].id,
    type: 'activity',
    status: isBooked ? 'booked' : 'not-booked',
    title: route,
    date: document.getElementById('stgDate').value,
    time: document.getElementById('stgStart').value,
    location: route,
    stage_number: document.getElementById('stgNumber').value,
    distance_km: document.getElementById('stgDistance').value,
    ascent_m: document.getElementById('stgAscent').value,
    descent_m: document.getElementById('stgDescent').value,
    moving_time: document.getElementById('stgMoving').value,
    breaks: document.getElementById('stgBreaks').value,
    start_time: document.getElementById('stgStart').value,
    finish_time: document.getElementById('stgFinish').value,
    route_map: document.getElementById('stgRouteMap').value,
    suggested_accommodation: document.getElementById('stgAccom').value,
    booking_priority: isBooked ? 'Booked' : document.getElementById('stgPriority').value,
    notes: document.getElementById('stgNotes').value,
    details: isBooked ? {
      phone: document.getElementById('stgPhone').value,
      address: document.getElementById('stgAddress').value,
      confirmationRef: document.getElementById('stgConfRef').value,
      refundable: document.getElementById('stgRefundable').checked
    } : (isNew ? {} : (currentTrip.itinerary[index].details || {}))
  };

  if (isNew) {
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    currentTrip.itinerary.push(stage);
  } else {
    currentTrip.itinerary[index] = stage;
  }

  // keep itinerary sorted by date so the stage list reads chronologically
  currentTrip.itinerary.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  commitItinerary();
}

function deleteStageRaw(index) {
  if (confirm("Remove this stage from your trek?")) {
    currentTrip.itinerary.splice(index, 1);
    commitItinerary();
  }
}