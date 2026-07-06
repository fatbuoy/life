/**
 * SAHANI SUITE — travel-planner: itinerary.js
 * Generic itinerary-item system shared by all non-adventure trip
 * categories: item-card rendering dispatch, multi-leg transit/journey
 * cards + form, lingo cards, and the six per-item-type forms
 * (food, sightseeing, accommodation, activity, note, lingo).
 * Depends on: core.js (constants, notesGroupHtml, removeItemFooterHtml,
 * toggleFieldVisibility, commitItinerary, getIconifyTag).
 */
'use strict';

/* ── MULTI-LEG TRANSIT JOURNEY CARD ──
   A single itinerary item of type "transit" with a `legs` array
   renders as one collapsible card: rolled-up total duration and
   booking status when collapsed, each leg (mode, from/to, times,
   carrier ref, status) plus transfer gaps between legs when
   expanded. Reusable for any future multi-leg journey — flights,
   trains, or mixed — just populate `legs` in the same shape. */
function minutesFromTime(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmtMinutes(mins) {
  if (mins === null || mins === undefined || isNaN(mins)) return '—';
  if (mins < 0) mins += 24 * 60; // assume overnight rollover
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function journeyTotals(legs) {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const startMin = minutesFromTime(first?.depart);
  const endMin = minutesFromTime(last?.arrive);
  const totalDuration = (startMin !== null && endMin !== null) ? fmtMinutes(endMin - startMin) : null;
  const allBooked = legs.every(l => l.status === 'booked');
  const anyBooked = legs.some(l => l.status === 'booked');
  const overallStatus = allBooked ? 'booked' : (anyBooked ? 'not-booked' : 'not-booked');
  return { startMin, endMin, totalDuration, overallStatus, legCount: legs.length };
}

function buildJourneyCardMarkup(item) {
  const idx = currentTrip.itinerary.findIndex(i => i.id === item.id);
  const legs = item.legs || [];
  const totals = journeyTotals(legs);
  const first = legs[0] || {};
  const last = legs[legs.length - 1] || {};

  const legsHtml = legs.map((leg, i) => {
    const modeIcon = TRANSIT_MODE_ICONS[leg.mode] || TRANSIT_MODE_ICONS.other;
    const legDuration = fmtMinutes(minutesFromTime(leg.arrive) - minutesFromTime(leg.depart));
    const legStatusColour = leg.status === 'booked' ? '#15803d' : '#ff781f';

    let transferHtml = '';
    if (i > 0) {
      const prevArrive = minutesFromTime(legs[i-1].arrive);
      const thisDepart = minutesFromTime(leg.depart);
      const gap = (prevArrive !== null && thisDepart !== null) ? fmtMinutes(thisDepart - prevArrive) : null;
      transferHtml = `
        <div style="display:flex; align-items:center; gap:8px; padding:4px 0 4px 17px; font-size:11px; color:#8e8e93;">
          <div style="width:2px; align-self:stretch; background:#e5e5ea; min-height:14px;"></div>
          <span>Transfer at ${leg.from || '—'}${gap ? ` · ${gap} wait` : ''}</span>
        </div>`;
    }

    return `
      ${transferHtml}
      <div style="display:flex; align-items:flex-start; gap:10px; padding:8px 0;">
        <div style="width:26px; height:26px; border-radius:7px; background:#f2f2f7; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">
          ${getIconifyTag(modeIcon, 14, '#3a3a3c')}
        </div>
        <div style="flex-grow:1; min-width:0;">
          <div style="font-size:13px; font-weight:600; color:#1c1c1e;">${leg.from || '?'} → ${leg.to || '?'}</div>
          <div style="font-size:11px; color:#8e8e93; margin-top:1px;">${leg.depart || '—'} – ${leg.arrive || '—'} · ${legDuration}${leg.carrierRef ? ' · ' + leg.carrierRef : ''}</div>
        </div>
        <span class="status-badge status-${leg.status}" style="font-size:8px; padding:2px 6px; flex-shrink:0; margin-top:2px;">${(leg.status||'').replace(/-/g,' ')}</span>
      </div>`;
  }).join('');

  return `
    <div class="ios-item-card">
      <div class="ios-item-summary" onclick="toggleCardDetails(this)">
        <div class="ios-item-icon" style="background:#e5f1ff;">${getIconifyTag('mdi:transit-connection-variant', 18, '#007aff')}</div>
        <div style="flex-grow:1;">
          <div style="font-weight:600; color:#1c1c1e; font-size:14px;">${item.title || 'Journey'}</div>
          <div style="font-size:12px; color:#8e8e93; margin-top:2px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span>${first.depart || ''} → ${last.arrive || ''}</span>
            <span>·</span>
            <span>${totals.totalDuration || '—'} total</span>
            <span>·</span>
            <span>${totals.legCount} leg${totals.legCount===1?'':'s'}</span>
            <span class="status-badge status-${totals.overallStatus}" style="font-size:9px; padding:2px 6px;">${totals.overallStatus.replace(/-/g,' ')}</span>
          </div>
        </div>
        <div class="expand-chevron" style="align-self:center; transition: transform 0.2s;">${getIconifyTag('mdi:chevron-down', 18, '#c7c7cc')}</div>
      </div>
      <div class="ios-item-details" style="display:none;">
        <div style="margin:-4px 0 8px;">${legsHtml}</div>
        ${item.notes ? `<div class="yellow-notes">${item.notes}</div>` : ''}
        <div style="margin-top:12px; text-align:right;">
          <button class="ios-link-btn bold" onclick="openActivityForm(${idx})">Edit Journey</button>
        </div>
      </div>
    </div>
  `;
}

function buildItemRowMarkup(item) {
  if (item.type === 'transit' && Array.isArray(item.legs)) {
    return buildJourneyCardMarkup(item);
  }
  if (item.type === 'lingo') {
    return buildLingoCardMarkup(item);
  }

  const cfg = ITEM_ICONS[item.type] || { icon: 'mdi:map-marker', color: '#1c1c1e', bg: '#f2f2f7' };
  const idx = currentTrip.itinerary.findIndex(i => i.id === item.id);
  const mapsUrl = item.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}` : '#';

  // Run / Hike / Bike stat badges — used both for the new generic
  // 'activity' item type (any trip) and reads the same field names
  // as the Adventure trip stage form for consistency.
  let activitySpecsHtml = '';
  if (item.type === 'activity' && (item.distance_km || item.ascent_m || item.descent_m)) {
    activitySpecsHtml = `
      <div style="display:flex; flex-wrap:wrap; gap:4px; margin:4px 0 2px 0;">
        ${item.distance_km ? `<span style="font-size:10px; background:#f2f2f7; color:#1c1c1e; padding:1px 5px; border-radius:4px; font-weight:600; display:inline-flex; align-items:center; gap:2px;">🏁 ${item.distance_km} km</span>` : ''}
        ${item.ascent_m ? `<span style="font-size:10px; background:#e2fbe8; color:#15803d; padding:1px 5px; border-radius:4px; font-weight:600; display:inline-flex; align-items:center; gap:2px;">▲ +${item.ascent_m}m</span>` : ''}
        ${item.descent_m ? `<span style="font-size:10px; background:#ffebeb; color:#b91c1c; padding:1px 5px; border-radius:4px; font-weight:600; display:inline-flex; align-items:center; gap:2px;">▼ -${item.descent_m}m</span>` : ''}
        ${item.moving_time ? `<span style="font-size:10px; background:#e5f1ff; color:#0055cc; padding:1px 5px; border-radius:4px; font-weight:600;">${item.moving_time}</span>` : ''}
      </div>
    `;
  }

  const isFavouritable = IDEA_BANK_CATEGORIES.includes(item.type);
  const showStatusBadge = item.type !== 'note';
  const fromLibraryTagHtml = item.fromLibrary ? `<span style="font-size:9px; color:#8e8e93; font-weight:600; background:#f2f2f7; padding:1px 6px; border-radius:6px;">📚 From Idea Bank</span>` : '';

  return `
    <div class="ios-item-card">
      <div class="ios-item-summary" onclick="toggleCardDetails(this)">
        <div class="ios-item-icon" style="background:${cfg.bg};">${getIconifyTag(item.type === 'activity' && item.activitySubtype ? (ACTIVITY_SUBTYPE_ICONS[item.activitySubtype] || cfg.icon) : cfg.icon, 18, cfg.color)}</div>
        <div style="flex-grow:1;">
          <div style="font-weight:600; color:#1c1c1e; font-size:14px;">${item.title || 'Untitled'}</div>
          ${activitySpecsHtml}
          <div style="font-size:12px; color:#8e8e93; margin-top:2px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            ${item.time ? `<span>${item.time}</span>` : ''}
            ${showStatusBadge ? `<span class="status-badge status-${item.status}" style="font-size:9px; padding:2px 6px;">${(item.status||'').replace(/-/g,' ')}</span>` : ''}
            ${fromLibraryTagHtml}
          </div>
        </div>
        <div class="expand-chevron" style="align-self:center; transition: transform 0.2s;">${getIconifyTag('mdi:chevron-down', 18, '#c7c7cc')}</div>
      </div>
      <div class="ios-item-details" style="display:none;">
        ${item.location ? `
          <div style="margin-bottom:6px;">
            <strong>${item.type === 'accommodation' ? 'Address' : 'Location'}:</strong> 
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--app-accent); text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; word-break: break-all;">
              ${item.location} ${getIconifyTag('mdi:map-marker-radius-outline', 14, 'var(--app-accent)')}
            </a>
          </div>` : ''}
        ${item.type === 'accommodation' && item.checkOutDate ? `<div style="margin-bottom:6px;"><strong>Check-out:</strong> ${fmtDate(item.checkOutDate)}</div>` : ''}
        ${item.details?.pnr ? `<div style="margin-bottom:6px;"><strong>${item.type === 'accommodation' ? 'Booking Number' : 'PNR/Ref'}:</strong> ${item.details.pnr}</div>` : ''}
        ${item.campsite ? `<div style="margin-bottom:6px;"><strong>Hut / Camp:</strong> ${item.campsite}</div>` : ''}
        ${item.notes ? `<div class="yellow-notes">${item.notes}</div>` : ''}
        <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
          ${isFavouritable ? `
            <button class="fav-btn" style="color:${item.favourite ? '#ff2d55' : '#8e8e93'};" onclick="toggleItemFavourite(${idx})">
              ${getIconifyTag(item.favourite ? 'mdi:heart' : 'mdi:heart-outline', 15, item.favourite ? '#ff2d55' : '#8e8e93')} ${item.favourite ? 'Saved to Idea Bank' : 'Save to Idea Bank'}
            </button>
          ` : '<span></span>'}
          <button class="ios-link-btn bold" onclick="openActivityForm(${idx})">Edit Details</button>
        </div>
      </div>
    </div>
  `;
}

function toggleCardDetails(summaryEl) {
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

/* ── LOCAL LINGO PHRASE CARD ──
   Renders a 'lingo' itinerary item. phrases is free text, one
   phrase per line in "English - Local translation" form (matching
   how phrases were originally captured for Napoli); split on the
   first " - " so translations containing dashes still display
   correctly. */
function buildLingoCardMarkup(item) {
  const lines = (item.phrases || '').split('\n').map(l => l.trim()).filter(Boolean);
  const rows = lines.map(line => {
    const sepIdx = line.indexOf(' - ');
    if (sepIdx === -1) return `<div class="lingo-phrase-row"><span class="lingo-phrase-en">${line}</span></div>`;
    const en = line.slice(0, sepIdx);
    const local = line.slice(sepIdx + 3);
    return `<div class="lingo-phrase-row"><span class="lingo-phrase-en">${en}</span><span class="lingo-phrase-local">${local}</span></div>`;
  }).join('');

  const idx = currentTrip.itinerary.findIndex(i => i.id === item.id);

  return `
    <div class="lingo-card">
      <div class="lingo-card-hdr">
        ${getIconifyTag('mdi:translate', 16, '#ff2d55')}
        <div class="lingo-card-title">${item.title || LINGO_OCCASIONS[item.occasion] || 'Phrases'}</div>
        <button class="ios-link-btn bold" style="font-size:12px;" onclick="openActivityForm(${idx})">Edit</button>
      </div>
      <div class="lingo-phrase-list">
        ${rows || '<p style="color:#8e8e93; font-size:12px; margin:6px 0;">No phrases added yet.</p>'}
        ${item.notes ? `<div class="yellow-notes" style="margin-top:8px;">${item.notes}</div>` : ''}
      </div>
    </div>
  `;
}


function openFoodForm(index, isNew) {
  const sheet = document.getElementById('iosSheet');
  const item = isNew
    ? { id: 'it-' + Date.now(), type: 'food', status: 'no-booking-required', title: '', date: currentTrip.startDate || '', time: '', location: '', notes: '', details: {} }
    : currentTrip.itinerary[index];

  const needsReservation = item.status === 'booked' || item.status === 'not-booked';
  const isIdea = !item.date;

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="openTripSheet('${currentTrip.id}')">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Restaurant / Food / Drink' : 'Edit Restaurant / Food / Drink'}</div>
      <button class="ios-link-btn bold" onclick="saveFoodLevel(${index})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Restaurant / Food / Drink</div>
      <div class="ios-group">
        ${ideaToggleRowHtml('fdIsIdea', 'fdDate', 'fdTime', 'Save to Trip Ideas (no date yet)', isIdea)}
        <div class="ios-row">
          <label class="ios-label">Name</label>
          <input type="text" id="fdTitle" class="ios-input" placeholder="e.g. Sorbillo" value="${item.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Location</label>
          <input type="text" id="fdLocation" class="ios-input" placeholder="Address" value="${item.location || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Date</label>
          <input type="date" id="fdDate" class="ios-input" value="${item.date || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
        <div class="ios-row">
          <label class="ios-label">Time</label>
          <input type="time" id="fdTime" class="ios-input" value="${item.time || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
      </div>

      <div class="ios-group-title">Reservation</div>
      <div class="ios-group">
        <div class="ios-row ios-row-between">
          <label class="ios-label">Needs Reservation</label>
          <label class="ios-switch">
            <input type="checkbox" id="fdNeedsRes" ${needsReservation ? 'checked' : ''} onchange="toggleFieldVisibility(this, ['fdResRow','block'])">
            <span class="ios-slider"></span>
          </label>
        </div>
        <div id="fdResRow" style="display:${needsReservation ? 'block' : 'none'};">
          <div class="ios-row ios-row-between">
            <label class="ios-label">Reservation Booked</label>
            <label class="ios-switch">
              <input type="checkbox" id="fdIsBooked" ${item.status === 'booked' ? 'checked' : ''}>
              <span class="ios-slider"></span>
            </label>
          </div>
          <div class="ios-row">
            <label class="ios-label">Confirmation Ref</label>
            <input type="text" id="fdConfRef" class="ios-input" placeholder="Booking reference" value="${item.details?.pnr || ''}">
          </div>
        </div>
      </div>

      ${notesGroupHtml('Notes', 'fdNotes', 'Must-try dishes, dietary notes...', item.notes)}

      ${removeItemFooterHtml(index, isNew)}
    </div>
  `;
  document.getElementById('iosOverlay').style.display = 'flex';
}

function saveFoodLevel(index) {
  const isNew = index === -1;
  const isIdea = document.getElementById('fdIsIdea').checked;
  const needsRes = document.getElementById('fdNeedsRes').checked;
  const isBooked = needsRes && document.getElementById('fdIsBooked').checked;

  const item = {
    id: isNew ? 'it-' + Date.now() : currentTrip.itinerary[index].id,
    type: 'food',
    status: !needsRes ? 'no-booking-required' : (isBooked ? 'booked' : 'not-booked'),
    title: document.getElementById('fdTitle').value,
    date: isIdea ? '' : document.getElementById('fdDate').value,
    time: isIdea ? '' : document.getElementById('fdTime').value,
    location: document.getElementById('fdLocation').value,
    notes: document.getElementById('fdNotes').value,
    details: { pnr: needsRes ? document.getElementById('fdConfRef').value : '' }
  };
  if (!isNew) {
    item.favourite = currentTrip.itinerary[index].favourite;
    item.libraryId = currentTrip.itinerary[index].libraryId;
    item.fromLibrary = currentTrip.itinerary[index].fromLibrary;
  }

  if (isNew) {
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    currentTrip.itinerary.push(item);
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  } else {
    currentTrip.itinerary[index] = item;
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  }

  commitItinerary();
}

/* ── SIGHT-SEEING ITEM FORM ──
   Same booking-reveals-contact pattern as Food, for tours, museums,
   shows etc. that may or may not need advance booking. Title /
   Location / Notes double as the fields carried into the Idea Bank
   library when the card's favourite heart is toggled on. */
function openSightseeingForm(index, isNew) {
  const sheet = document.getElementById('iosSheet');
  const item = isNew
    ? { id: 'it-' + Date.now(), type: 'sightseeing', status: 'no-booking-required', title: '', date: currentTrip.startDate || '', time: '', location: '', notes: '', details: {} }
    : currentTrip.itinerary[index];

  const needsBooking = item.status === 'booked' || item.status === 'not-booked' || item.status === 'planned';
  const isIdea = !item.date;

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="openTripSheet('${currentTrip.id}')">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Sight-Seeing' : 'Edit Sight-Seeing'}</div>
      <button class="ios-link-btn bold" onclick="saveSightseeingLevel(${index})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Sight-Seeing</div>
      <div class="ios-group">
        ${ideaToggleRowHtml('sgtIsIdea', 'sgtDate', 'sgtTime', 'Save to Trip Ideas (no date yet)', isIdea)}
        <div class="ios-row">
          <label class="ios-label">Name</label>
          <input type="text" id="sgtTitle" class="ios-input" placeholder="e.g. Pompeii Tour" value="${item.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Address</label>
          <input type="text" id="sgtLocation" class="ios-input" placeholder="Address" value="${item.location || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Date</label>
          <input type="date" id="sgtDate" class="ios-input" value="${item.date || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
        <div class="ios-row">
          <label class="ios-label">Time</label>
          <input type="time" id="sgtTime" class="ios-input" value="${item.time || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
      </div>

      <div class="ios-group-title">Booking</div>
      <div class="ios-group">
        <div class="ios-row ios-row-between">
          <label class="ios-label">Needs Booking</label>
          <label class="ios-switch">
            <input type="checkbox" id="sgtNeedsBooking" ${needsBooking ? 'checked' : ''} onchange="toggleFieldVisibility(this, ['sgtBookingRow','block'])">
            <span class="ios-slider"></span>
          </label>
        </div>
        <div id="sgtBookingRow" style="display:${needsBooking ? 'block' : 'none'};">
          <div class="ios-row ios-row-between">
            <label class="ios-label">Booked</label>
            <label class="ios-switch">
              <input type="checkbox" id="sgtIsBooked" ${item.status === 'booked' ? 'checked' : ''}>
              <span class="ios-slider"></span>
            </label>
          </div>
          <div class="ios-row">
            <label class="ios-label">Confirmation Ref</label>
            <input type="text" id="sgtConfRef" class="ios-input" placeholder="Booking reference" value="${item.details?.pnr || ''}">
          </div>
        </div>
      </div>

      ${notesGroupHtml('Notes', 'sgtNotes', 'What to bring, tips...', item.notes)}

      ${removeItemFooterHtml(index, isNew)}
    </div>
  `;
  document.getElementById('iosOverlay').style.display = 'flex';
}

function saveSightseeingLevel(index) {
  const isNew = index === -1;
  const isIdea = document.getElementById('sgtIsIdea').checked;
  const needsBooking = document.getElementById('sgtNeedsBooking').checked;
  const isBooked = needsBooking && document.getElementById('sgtIsBooked').checked;

  const item = {
    id: isNew ? 'it-' + Date.now() : currentTrip.itinerary[index].id,
    type: 'sightseeing',
    status: !needsBooking ? 'no-booking-required' : (isBooked ? 'booked' : 'not-booked'),
    title: document.getElementById('sgtTitle').value,
    date: isIdea ? '' : document.getElementById('sgtDate').value,
    time: isIdea ? '' : document.getElementById('sgtTime').value,
    location: document.getElementById('sgtLocation').value,
    notes: document.getElementById('sgtNotes').value,
    details: { pnr: needsBooking ? document.getElementById('sgtConfRef').value : '' }
  };
  if (!isNew) {
    item.favourite = currentTrip.itinerary[index].favourite;
    item.libraryId = currentTrip.itinerary[index].libraryId;
    item.fromLibrary = currentTrip.itinerary[index].fromLibrary;
  }

  if (isNew) {
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    currentTrip.itinerary.push(item);
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  } else {
    currentTrip.itinerary[index] = item;
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  }

  commitItinerary();
}

/* ── ACCOMMODATION ITEM FORM ──
   Name / address / booking number / check-in & check-out dates /
   booking status. The "Save to Trip Ideas" toggle doubles as the
   Idea-Bank-vs-Final distinction requested for this item type: an
   idea has no dates yet, a final entry does. */
function openAccommodationForm(index, isNew) {
  const sheet = document.getElementById('iosSheet');
  const item = isNew
    ? { id: 'it-' + Date.now(), type: 'accommodation', status: 'not-booked', title: '', date: currentTrip.startDate || '', checkOutDate: '', location: '', notes: '', details: {} }
    : currentTrip.itinerary[index];

  const isIdea = !item.date;

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="openTripSheet('${currentTrip.id}')">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Accommodation' : 'Edit Accommodation'}</div>
      <button class="ios-link-btn bold" onclick="saveAccommodationLevel(${index})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Accommodation</div>
      <div class="ios-group">
        ${ideaToggleRowHtml('acmIsIdea', 'acmCheckIn', 'acmCheckOut', 'Idea Bank Entry (no dates yet)', isIdea)}
        <div class="ios-row">
          <label class="ios-label">Name</label>
          <input type="text" id="acmTitle" class="ios-input" placeholder="e.g. Hotel Piazza Bellini" value="${item.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Address</label>
          <input type="text" id="acmLocation" class="ios-input" placeholder="Address" value="${item.location || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Check-in</label>
          <input type="date" id="acmCheckIn" class="ios-input" value="${item.date || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
        <div class="ios-row">
          <label class="ios-label">Check-out</label>
          <input type="date" id="acmCheckOut" class="ios-input" value="${item.checkOutDate || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
      </div>

      <div class="ios-group-title">Booking</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Booking Number</label>
          <input type="text" id="acmBookingNum" class="ios-input" placeholder="Confirmation / booking number" value="${item.details?.pnr || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Booking Status</label>
          <select id="acmStatus" class="ios-select">
            <option value="not-booked" ${item.status==='not-booked'?'selected':''}>Not Booked</option>
            <option value="booked" ${item.status==='booked'?'selected':''}>Booked</option>
            <option value="no-booking-required" ${item.status==='no-booking-required'?'selected':''}>No Booking Required</option>
          </select>
        </div>
      </div>

      ${notesGroupHtml('Notes', 'acmNotes', 'Room type, breakfast, parking...', item.notes)}

      ${removeItemFooterHtml(index, isNew)}
    </div>
  `;
  document.getElementById('iosOverlay').style.display = 'flex';
}

function saveAccommodationLevel(index) {
  const isNew = index === -1;
  const isIdea = document.getElementById('acmIsIdea').checked;

  const item = {
    id: isNew ? 'it-' + Date.now() : currentTrip.itinerary[index].id,
    type: 'accommodation',
    status: document.getElementById('acmStatus').value,
    title: document.getElementById('acmTitle').value,
    date: isIdea ? '' : document.getElementById('acmCheckIn').value,
    checkOutDate: isIdea ? '' : document.getElementById('acmCheckOut').value,
    location: document.getElementById('acmLocation').value,
    notes: document.getElementById('acmNotes').value,
    details: { pnr: document.getElementById('acmBookingNum').value }
  };
  if (!isNew) {
    item.favourite = currentTrip.itinerary[index].favourite;
    item.libraryId = currentTrip.itinerary[index].libraryId;
    item.fromLibrary = currentTrip.itinerary[index].fromLibrary;
  }

  if (isNew) {
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    currentTrip.itinerary.push(item);
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  } else {
    currentTrip.itinerary[index] = item;
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  }

  commitItinerary();
}

/* ── ACTIVITY (RUN / HIKE / BIKE) ITEM FORM ──
   For a logged workout within any non-Adventure trip — same stat
   fields as an Adventure-trip stage (distance_km/ascent_m/descent_m/
   moving_time) so the two render consistently, but lighter-weight
   since there's no booking/priority/accommodation context here. */
function openTripActivityForm(index, isNew) {
  const sheet = document.getElementById('iosSheet');
  const item = isNew
    ? { id: 'it-' + Date.now(), type: 'activity', status: 'no-booking-required', activitySubtype: 'run', title: '', date: currentTrip.startDate || '', time: '', distance_km: '', ascent_m: '', descent_m: '', moving_time: '', notes: '', details: {} }
    : currentTrip.itinerary[index];

  const isIdea = !item.date;

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="openTripSheet('${currentTrip.id}')">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Activity' : 'Edit Activity'}</div>
      <button class="ios-link-btn bold" onclick="saveTripActivityLevel(${index})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Activity</div>
      <div class="ios-group">
        ${ideaToggleRowHtml('tavIsIdea', 'tavDate', 'tavTime', 'Save to Trip Ideas (no date yet)', isIdea)}
        <div class="ios-row">
          <label class="ios-label">Type</label>
          <select id="tavSubtype" class="ios-select">
            <option value="run" ${item.activitySubtype==='run'?'selected':''}>Run</option>
            <option value="hike" ${item.activitySubtype==='hike'?'selected':''}>Hike</option>
            <option value="bike" ${item.activitySubtype==='bike'?'selected':''}>Bike</option>
          </select>
        </div>
        <div class="ios-row">
          <label class="ios-label">Title / Route</label>
          <input type="text" id="tavTitle" class="ios-input" placeholder="e.g. Lakeside loop" value="${item.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Date</label>
          <input type="date" id="tavDate" class="ios-input" value="${item.date || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
        <div class="ios-row">
          <label class="ios-label">Start Time</label>
          <input type="time" id="tavTime" class="ios-input" value="${item.time || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
      </div>

      <div class="ios-group-title">Stats</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Distance (km)</label>
          <input type="number" step="0.1" id="tavDistance" class="ios-input" placeholder="e.g. 10" value="${item.distance_km || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Ascent (m)</label>
          <input type="number" id="tavAscent" class="ios-input" placeholder="e.g. 150" value="${item.ascent_m || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Descent (m)</label>
          <input type="number" id="tavDescent" class="ios-input" placeholder="e.g. 150" value="${item.descent_m || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Moving Time</label>
          <input type="text" id="tavMovingTime" class="ios-input" placeholder="e.g. 1h05" value="${item.moving_time || ''}">
        </div>
      </div>

      ${notesGroupHtml('Notes', 'tavNotes', 'Route notes, pace target...', item.notes)}

      ${removeItemFooterHtml(index, isNew)}
    </div>
  `;
  document.getElementById('iosOverlay').style.display = 'flex';
}

function saveTripActivityLevel(index) {
  const isNew = index === -1;
  const isIdea = document.getElementById('tavIsIdea').checked;

  const item = {
    id: isNew ? 'it-' + Date.now() : currentTrip.itinerary[index].id,
    type: 'activity',
    status: 'no-booking-required',
    activitySubtype: document.getElementById('tavSubtype').value,
    title: document.getElementById('tavTitle').value,
    date: isIdea ? '' : document.getElementById('tavDate').value,
    time: isIdea ? '' : document.getElementById('tavTime').value,
    distance_km: document.getElementById('tavDistance').value,
    ascent_m: document.getElementById('tavAscent').value,
    descent_m: document.getElementById('tavDescent').value,
    moving_time: document.getElementById('tavMovingTime').value,
    notes: document.getElementById('tavNotes').value,
    details: {}
  };

  if (isNew) {
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    currentTrip.itinerary.push(item);
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  } else {
    currentTrip.itinerary[index] = item;
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  }

  commitItinerary();
}

/* ── QUICK NOTE ITEM FORM ──
   Deliberately minimal: title, date, time, free text. Renders as a
   collapsed card inline with the rest of the day's items, sorted by
   date/time exactly like every other itinerary entry. */
function openNoteForm(index, isNew) {
  const sheet = document.getElementById('iosSheet');
  const item = isNew
    ? { id: 'it-' + Date.now(), type: 'note', status: 'no-booking-required', title: '', date: currentTrip.startDate || '', time: '', notes: '', details: {} }
    : currentTrip.itinerary[index];

  const isIdea = !item.date;

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="openTripSheet('${currentTrip.id}')">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Note' : 'Edit Note'}</div>
      <button class="ios-link-btn bold" onclick="saveNoteLevel(${index})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Quick Note</div>
      <div class="ios-group">
        ${ideaToggleRowHtml('ntIsIdea', 'ntDate', 'ntTime', 'Save to Trip Ideas (no date yet)', isIdea)}
        <div class="ios-row">
          <label class="ios-label">Title</label>
          <input type="text" id="ntTitle" class="ios-input" placeholder="e.g. Pack rain jacket" value="${item.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Date</label>
          <input type="date" id="ntDate" class="ios-input" value="${item.date || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
        <div class="ios-row">
          <label class="ios-label">Time</label>
          <input type="time" id="ntTime" class="ios-input" value="${item.time || ''}" ${isIdea ? 'disabled' : ''}>
        </div>
      </div>

      ${notesGroupHtml('Note', 'ntNotes', "Anything you don't want to forget...", item.notes)}

      ${removeItemFooterHtml(index, isNew)}
    </div>
  `;
  document.getElementById('iosOverlay').style.display = 'flex';
}

function saveNoteLevel(index) {
  const isNew = index === -1;
  const isIdea = document.getElementById('ntIsIdea').checked;

  const item = {
    id: isNew ? 'it-' + Date.now() : currentTrip.itinerary[index].id,
    type: 'note',
    status: 'no-booking-required',
    title: document.getElementById('ntTitle').value,
    date: isIdea ? '' : document.getElementById('ntDate').value,
    time: isIdea ? '' : document.getElementById('ntTime').value,
    notes: document.getElementById('ntNotes').value,
    details: {}
  };

  if (isNew) {
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    currentTrip.itinerary.push(item);
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  } else {
    currentTrip.itinerary[index] = item;
    activeSubTab = item.date ? 'itinerary' : 'ideas';
  }

  commitItinerary();
}

/* ── LOCAL LINGO ITEM FORM ──
   Purpose-built for phrase sheets rather than the generic
   title/date/location pattern: pick an occasion (which also
   determines which slot this fills in that country's Lingo Library),
   then one phrase per line as "English - Local translation". */
function openLingoForm(index, isNew) {
  const sheet = document.getElementById('iosSheet');
  const item = isNew
    ? { id: 'it-' + Date.now(), type: 'lingo', status: 'no-booking-required', occasion: 'greetings', title: '', phrases: '', notes: '', details: {} }
    : currentTrip.itinerary[index];

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="openTripSheet('${currentTrip.id}')">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Phrase Sheet' : 'Edit Phrase Sheet'}</div>
      <button class="ios-link-btn bold" onclick="saveLingoLevel(${index})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Local Lingo</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Occasion</label>
          <select id="lngOccasion" class="ios-select" onchange="document.getElementById('lngTitle').value = this.options[this.selectedIndex].text;">
            ${Object.entries(LINGO_OCCASIONS).map(([k,v]) => `<option value="${k}" ${item.occasion===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="ios-row">
          <label class="ios-label">Title</label>
          <input type="text" id="lngTitle" class="ios-input" value="${item.title || LINGO_OCCASIONS[item.occasion] || ''}">
        </div>
      </div>

      ${notesGroupHtml('Phrases — one per line, "English - Local"', 'lngPhrases', 'Hello - Ciao&#10;Thank you - Grazie', item.phrases, 'min-height:160px;')}

      ${notesGroupHtml('Notes', 'lngNotes', 'Pronunciation tips, regional variants...', item.notes)}

      ${removeItemFooterHtml(index, isNew)}
    </div>
  `;
  document.getElementById('iosOverlay').style.display = 'flex';
}

function saveLingoLevel(index) {
  const isNew = index === -1;

  const item = {
    id: isNew ? 'it-' + Date.now() : currentTrip.itinerary[index].id,
    type: 'lingo',
    status: 'no-booking-required',
    occasion: document.getElementById('lngOccasion').value,
    title: document.getElementById('lngTitle').value,
    phrases: document.getElementById('lngPhrases').value,
    notes: document.getElementById('lngNotes').value,
    details: {}
  };

  if (isNew) {
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    currentTrip.itinerary.push(item);
  } else {
    currentTrip.itinerary[index] = item;
  }

  // Push this phrase sheet up into the country's Lingo Library too,
  // so future trips to the same country get it automatically.
  const country = extractCountry(currentTrip.destination);
  if (country && item.phrases) {
    if (!DATA.lingoLibrary) DATA.lingoLibrary = {};
    if (!DATA.lingoLibrary[country]) DATA.lingoLibrary[country] = {};
    DATA.lingoLibrary[country][item.occasion] = { title: item.title, phrases: item.phrases };
  }

  commitItinerary();
}

/* ── MULTI-LEG TRANSIT JOURNEY EDIT FORM ──
   Edits a transit item's `legs` array. journeyLegsDraft holds the
   in-progress legs while the form is open; each leg row re-renders
   from this array so legs can be added/removed dynamically. Saving
   reads the draft back out, recalculates nothing else (durations
   are derived at render time in buildJourneyCardMarkup), and writes
   to currentTrip.itinerary like every other item type. */
let journeyLegsDraft = [];

function openJourneyForm(index, isNew) {
  const sheet = document.getElementById('iosSheet');
  const item = isNew
    ? { id: 'it-' + Date.now(), type: 'transit', title: '', date: currentTrip.startDate || '', notes: '', legs: [] }
    : currentTrip.itinerary[index];

  journeyLegsDraft = (item.legs && item.legs.length)
    ? JSON.parse(JSON.stringify(item.legs))
    : [{ mode: 'train', from: '', to: '', depart: '', arrive: '', carrierRef: '', status: 'not-booked' }];

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="openTripSheet('${currentTrip.id}')">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Journey' : 'Edit Journey'}</div>
      <button class="ios-link-btn bold" onclick="saveJourneyLevel(${index})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Journey</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Title</label>
          <input type="text" id="jrnTitle" class="ios-input" placeholder="e.g. Outbound: Home → Napoli" value="${item.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Date</label>
          <input type="date" id="jrnDate" class="ios-input" value="${item.date || ''}">
        </div>
      </div>

      <div class="ios-group-title">Legs</div>
      <div id="journeyLegsContainer"></div>
      <div style="padding: 0 8px; margin-top: 6px;">
        <button class="ios-link-btn bold" style="width:100%; text-align:center; background:#e5f1ff; color:#007aff; padding:10px; border-radius:10px;" onclick="addJourneyLeg()">+ Add Leg</button>
      </div>

      ${notesGroupHtml('Notes', 'jrnNotes', 'Seat numbers, platform notes...', item.notes)}

      ${removeItemFooterHtml(index, isNew, 'deleteActivityRaw', 'Remove Journey')}
    </div>
  `;

  document.getElementById('iosOverlay').style.display = 'flex';
  renderJourneyLegRows();
}

function renderJourneyLegRows() {
  const container = document.getElementById('journeyLegsContainer');
  container.innerHTML = journeyLegsDraft.map((leg, i) => `
    <div class="ios-group" style="margin-bottom:8px;">
      <div class="ios-row" style="justify-content:space-between; padding-bottom:0;">
        <span style="font-size:11px; font-weight:700; color:#8e8e93; text-transform:uppercase; letter-spacing:0.4px;">Leg ${i + 1}</span>
        ${journeyLegsDraft.length > 1 ? `<button class="ios-link-btn danger" style="font-size:12px;" onclick="removeJourneyLeg(${i})">Remove</button>` : ''}
      </div>
      <div class="ios-row">
        <label class="ios-label">Mode</label>
        <select class="ios-select" data-leg="${i}" data-field="mode" onchange="updateJourneyLeg(${i}, 'mode', this.value)">
          ${['train','flight','bus','ferry','car','other'].map(m => `<option value="${m}" ${leg.mode===m?'selected':''}>${m.charAt(0).toUpperCase()+m.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="ios-row">
        <label class="ios-label">From</label>
        <input type="text" class="ios-input" placeholder="Origin" data-leg="${i}" data-field="from" value="${leg.from || ''}" oninput="updateJourneyLeg(${i}, 'from', this.value)">
      </div>
      <div class="ios-row">
        <label class="ios-label">To</label>
        <input type="text" class="ios-input" placeholder="Destination" data-leg="${i}" data-field="to" value="${leg.to || ''}" oninput="updateJourneyLeg(${i}, 'to', this.value)">
      </div>
      <div class="ios-row">
        <label class="ios-label">Departs</label>
        <input type="time" class="ios-input" data-leg="${i}" data-field="depart" value="${leg.depart || ''}" oninput="updateJourneyLeg(${i}, 'depart', this.value)">
      </div>
      <div class="ios-row">
        <label class="ios-label">Arrives</label>
        <input type="time" class="ios-input" data-leg="${i}" data-field="arrive" value="${leg.arrive || ''}" oninput="updateJourneyLeg(${i}, 'arrive', this.value)">
      </div>
      <div class="ios-row">
        <label class="ios-label">Flight/Train No.</label>
        <input type="text" class="ios-input" placeholder="e.g. IR56, LX1234" data-leg="${i}" data-field="carrierRef" value="${leg.carrierRef || ''}" oninput="updateJourneyLeg(${i}, 'carrierRef', this.value)">
      </div>
      <div class="ios-row" style="justify-content:space-between;">
        <label class="ios-label">Booked</label>
        <label class="ios-switch">
          <input type="checkbox" data-leg="${i}" data-field="status" ${leg.status === 'booked' ? 'checked' : ''} onchange="updateJourneyLeg(${i}, 'status', this.checked ? 'booked' : 'not-booked')">
          <span class="ios-slider"></span>
        </label>
      </div>
    </div>
  `).join('');
}

function updateJourneyLeg(i, field, value) {
  journeyLegsDraft[i][field] = value;
}

/* Flush current DOM input values into journeyLegsDraft before any
   re-render. iOS can delay oninput until blur, so without this flush
   the last-typed value in a focused field is lost when innerHTML is
   replaced. data-leg / data-field attributes added to every control
   in renderJourneyLegRows make the query trivial. */
function flushJourneyLegInputs() {
  const container = document.getElementById('journeyLegsContainer');
  if (!container) return;
  container.querySelectorAll('[data-leg][data-field]').forEach(el => {
    const i = parseInt(el.dataset.leg, 10);
    const field = el.dataset.field;
    if (i >= journeyLegsDraft.length) return;
    if (el.type === 'checkbox') {
      journeyLegsDraft[i][field] = el.checked ? 'booked' : 'not-booked';
    } else {
      journeyLegsDraft[i][field] = el.value;
    }
  });
}

function addJourneyLeg() {
  flushJourneyLegInputs();
  const last = journeyLegsDraft[journeyLegsDraft.length - 1];
  journeyLegsDraft.push({ mode: last?.mode || 'train', from: last?.to || '', to: '', depart: '', arrive: '', carrierRef: '', status: 'not-booked' });
  renderJourneyLegRows();
}

function removeJourneyLeg(i) {
  flushJourneyLegInputs();
  journeyLegsDraft.splice(i, 1);
  renderJourneyLegRows();
}

function saveJourneyLevel(index) {
  flushJourneyLegInputs();
  const isNew = index === -1;
  const legs = journeyLegsDraft.filter(l => l.from || l.to || l.depart);
  const allBooked = legs.length > 0 && legs.every(l => l.status === 'booked');

  const item = {
    id: isNew ? 'it-' + Date.now() : currentTrip.itinerary[index].id,
    type: 'transit',
    status: allBooked ? 'booked' : 'not-booked',
    title: document.getElementById('jrnTitle').value,
    date: document.getElementById('jrnDate').value,
    legs: legs,
    notes: document.getElementById('jrnNotes').value
  };

  if (isNew) {
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    currentTrip.itinerary.push(item);
  } else {
    currentTrip.itinerary[index] = item;
  }

  commitItinerary();
}

/* ── ITEM FORM ROUTER ──
   Every item type now has its own purpose-built form (added above);
   this just dispatches to the right one. fallbackType is used only
   when creating a brand-new item (the "Add" tile grid passes its
   own type in), since an existing item already carries its type. */
function openActivityForm(index, fallbackType = 'note') {
  const isNew = index === -1;
  const existingType = isNew ? fallbackType : currentTrip.itinerary[index].type;

  if (existingType === 'sightseeing') { openSightseeingForm(index, isNew); return; }
  if (existingType === 'food') { openFoodForm(index, isNew); return; }
  if (existingType === 'transit') { openJourneyForm(index, isNew); return; }
  if (existingType === 'accommodation') { openAccommodationForm(index, isNew); return; }
  if (existingType === 'activity') { openTripActivityForm(index, isNew); return; }
  if (existingType === 'lingo') { openLingoForm(index, isNew); return; }
  openNoteForm(index, isNew);
}

function deleteActivityRaw(index) {
  if (confirm("Remove this item from your trip?")) {
    currentTrip.itinerary.splice(index, 1);
    commitItinerary();
  }
}

/* promptForGitToken() and the core sync PUT request now live in
   ../../shared/utils.js as promptForGitToken()/syncToGitHub() — every
   Sahani Suite app can call them the same way. This wrapper just
   supplies travel-planner's own GITHUB_CONFIG and payload shape so
   every existing triggerGitHubAutoSync() call site elsewhere in this
   file keeps working unchanged. */
