/**
 * SAHANI SUITE — travel-planner: core.js
 * Config, data load/save/sync, calendar & list browsing, tab switching,
 * trip-level CRUD, and generic form helpers shared by itinerary.js,
 * adventure.js and library.js.
 * Load order: utils.js -> core.js -> itinerary.js -> adventure.js -> library.js
 */
'use strict';

const GITHUB_CONFIG = {
  owner: "fatbuoy", 
  repo: "app-data",       
  path: "data/travel.json",     
  branch: "main"                
};

let DATA = null;
let currentYear = 2026;
let currentTrip = null;
let activeSubTab = 'itinerary';
let trekStageFilter = 'all';
let libraryFilter = 'all';
let librarySearch = '';

/* ── REUSABLE MULTI-DAY TREK / BIKEPACKING STAGE VIEW ──
   Any trip with type "adventure" gets the bespoke stage-list
   modal below instead of the generic itinerary view. Stage data is
   read directly from that trip's itinerary array in travel.json —
   each item needs distance_km/ascent_m/descent_m/moving_time/breaks/
   start_time/finish_time/suggested_accommodation/booking_priority/
   stage_number fields (rest & travel days simply have 0 distance).
   To reuse for a future hike or bikepacking trip, just set that
   trip's type to "adventure" and populate the same itinerary
   fields — no code changes needed. */
const TREK_PRIORITY_COLOUR = { 'Critical': '#e11d48', 'High': '#ff781f', 'Medium': '#d4a017', 'Low': '#8e8e93', 'Booked': '#15803d' };

const TYPE_META = {
  'visitors':    { label:'Visitors',    colour:'#10b981', icon:'mdi:account-group-outline' },
  'family':      { label:'Family',      colour:'#8b5cf6', icon:'mdi:home-heart' },
  'adventure':   { label:'Adventure',   colour:'#15803d', icon:'mdi:terrain' },
  'leisure':     { label:'Leisure',     colour:'#06b6d4', icon:'mdi:beach' },
  'work':        { label:'Work',        colour:'#64748b', icon:'mdi:briefcase-outline' },
  'race':        { label:'Race',        colour:'#e11d48', icon:'mdi:trophy-outline' },
  'hibernation': { label:'Hibernation', colour:'#9d174d', icon:'custom:pomegranate' }
};

/* ── ITEM TYPES ──
   'sightseeing' replaces the old generic 'activity' (tours, cafes,
   sights — anything that isn't a physical workout). 'activity' now
   means a run / hike / bike ride logged against the trip, using the
   same distance_km/ascent_m/descent_m/moving_time fields as the
   Adventure trip stages. Accommodation, Food & Drink and
   Sight-Seeing are the three categories eligible for the Idea Bank
   (favourite heart on the card -> saved to the cross-trip library). */
const ITEM_ICONS = {
  'transit': { icon: 'mdi:transit-connection-variant', color: '#007aff', bg: '#e5f1ff', lbl: 'Transit' },
  'accommodation': { icon: 'mdi:bed-outline', color: '#5856d6', bg: '#f0eeff', lbl: 'Accommodation' },
  'food': { icon: 'mdi:silverware-fork-knife', color: '#ff9500', bg: '#fff5e6', lbl: 'Restaurant / Food / Drink' },
  'sightseeing': { icon: 'mdi:binoculars', color: '#4cd964', bg: '#edfbe7', lbl: 'Sight-Seeing' },
  'activity': { icon: 'mdi:run-fast', color: '#ff781f', bg: '#fff1e6', lbl: 'Activity (Run / Hike / Bike)' },
  'lingo': { icon: 'mdi:translate', color: '#ff2d55', bg: '#ffe5ec', lbl: 'Local Lingo' },
  'note': { icon: 'mdi:note-text-outline', color: '#8e8e93', bg: '#f2f2f7', lbl: 'Quick Note' }
};

const IDEA_BANK_CATEGORIES = ['accommodation', 'food', 'sightseeing'];
const ACTIVITY_SUBTYPE_ICONS = { 'run': 'mdi:run-fast', 'hike': 'mdi:hiking', 'bike': 'mdi:bike' };

const LINGO_OCCASIONS = {
  'greetings':  'Basic Greetings',
  'restaurant': 'Restaurant: Ordering & Paying',
  'shopping':   'Shopping',
  'directions': 'Directions & Transport',
  'custom':     'Custom / Other'
};

const TRANSIT_MODE_ICONS = {
  'train': 'mdi:train', 'flight': 'mdi:airplane', 'bus': 'mdi:bus',
  'ferry': 'mdi:ferry', 'car': 'mdi:car', 'other': 'mdi:dots-horizontal-circle-outline'
};

function getIconifyTag(name, size = 18, color = 'currentColor') {
  if (name === 'custom:pomegranate') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
      <path d="M12 6c-4 0-7.5 3-7.5 7.5s3.5 7.5 7.5 7.5 7.5-3.5 7.5-7.5-3.5-7.5-7.5-7.5z"/>
      <path d="M10 6L9 3h2l1 2.5 1-2.5h2l-1 3"/>
      <path d="M12 10c-1.2 0-2 1-2 2.5s.8 2.5 2 3.5c1-1 2-2 2-3.5s-.8-2.5-2-2.5z"/>
    </svg>`;
  }
  return `<iconify-icon icon="${name}" style="font-size: ${size}px; color: ${color}; display: inline-block; vertical-align: middle;"></iconify-icon>`;
}

async function loadData() {
  const token = localStorage.getItem('gh_pat_token');
  
  if (token) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}?ref=${GITHUB_CONFIG.branch}`;
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (res.ok) {
        const fileData = await res.json();
        const decoded = decodeURIComponent(escape(atob(fileData.content)));
        DATA = JSON.parse(decoded);
      }
    } catch(e) {
      console.error("Live GitHub API authentication pull failed. Routing offline failover...", e);
    }
  }
  
  if (!DATA) {
    const storedFull = localStorage.getItem('wanderer_data_v2');
    if (storedFull) {
      try { DATA = JSON.parse(storedFull); } catch(e) {}
    }
  }

  if (!DATA) {
    // Legacy fallback: pre-Idea-Bank local saves only ever held the trips array.
    const stored = localStorage.getItem('wanderer_trips');
    if (stored) { try { DATA = { trips: JSON.parse(stored), meta: {} }; } catch(e){} }
  }
  
  if (!DATA) DATA = { trips: [], meta: {} };
  if (!DATA.ideaBank) DATA.ideaBank = [];
  if (!DATA.lingoLibrary) DATA.lingoLibrary = {};

  updateCountBadge();
  render();
}

/* Single source of truth for local persistence: the whole DATA object
   (trips + ideaBank + lingoLibrary + meta), so the Idea Bank and Lingo
   Library survive offline / before a GitHub sync. Replaces the old
   trips-only 'wanderer_trips' key, which is still read once as a
   legacy fallback in loadData() above. */
/* Single source of truth for the exportable snapshot of app data — used
   by persistLocal() (localStorage), triggerGitHubAutoSync() (git push),
   and exportJSON() (manual backup download) so the three never drift
   out of sync with each other. */
function buildExportPayload() {
  return {
    meta: DATA.meta || {},
    trips: realTrips(),
    ideaBank: DATA.ideaBank || [],
    lingoLibrary: DATA.lingoLibrary || {}
  };
}

function persistLocal() {
  localStorage.setItem('wanderer_data_v2', JSON.stringify(buildExportPayload()));
}

/* ── SHARED ITINERARY COMMIT ──
   Every itinerary-level save/delete (food, sightseeing, accommodation,
   activity, note, lingo, journey, trek stage) ends the same way: write
   currentTrip.itinerary back into the master DATA.trips record,
   recompute the trip's derived status, persist, re-render, and re-open
   the trip sheet. Centralised here so each save*Level/delete*Raw
   function only needs to mutate currentTrip.itinerary, then call this. */
function commitItinerary() {
  const masterIdx = DATA.trips.findIndex(t => t.id === currentTrip.id);
  DATA.trips[masterIdx].itinerary = currentTrip.itinerary;
  DATA.trips[masterIdx].status = deriveTripStatus(currentTrip.endDate, currentTrip.itinerary);

  persistLocal();
  render();
  openTripSheet(currentTrip.id);
  triggerGitHubAutoSync();
}

function updateCountBadge() {
  const count = realTrips().filter(t => t.startDate?.startsWith(String(currentYear))).length;
  const badge = document.getElementById('tripBadge');
  badge.textContent = count + ' trips';
  badge.style.display = '';
}

function render() {
  document.getElementById('yearLabel').textContent = currentYear;
  renderCalendar();
  renderUpcomingStrip();
  renderTripList();
  renderLibraryTab();
  updateKnownDestinationsList();
}

function realTrips() { return DATA.trips ? DATA.trips.filter(t => !t._comment) : []; }
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

function nightsBetween(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  const nights = Math.round((end - start) / 86400000);
  return nights > 0 ? nights : null;
}

function changeYear(dir) {
  currentYear += dir;
  updateCountBadge();
  render();
}

function daysUntil(dateStr) {
  if (!dateStr) return 0;
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  target.setHours(0,0,0,0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function deriveTripStatus(endDate, items) {
  const today = new Date().toISOString().split('T')[0];
  if (endDate && endDate < today) return 'Completed';
  if (!items || items.length === 0) return 'Unplanned';
  const booked = items.filter(i => i.status === 'booked' || i.status === 'no-booking-required' || i.status === 'confirmed').length;
  const notBooked = items.filter(i => i.status === 'not-booked' || i.status === 'tbc').length;
  if (booked === 0) return 'Unplanned';
  if (notBooked > 0) return 'Planning';
  return 'Planned';
}

function renderUpcomingStrip() {
  const el = document.getElementById('upcomingStrip');
  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = realTrips().filter(t => {
    const isInProgress = t.startDate <= todayStr && t.endDate >= todayStr;
    const isUpcomingSoon = daysUntil(t.startDate) >= 0 && daysUntil(t.startDate) <= 120;
    return isInProgress || isUpcomingSoon;
  }).sort((a,b) => a.startDate.localeCompare(b.startDate));
  if(upcoming.length === 0) {
    el.innerHTML = `<p style="color:#8e8e93; font-style:italic; padding:10px 4px; margin:0;">No upcoming trips planned for the next 120 days.</p>`;
    return;
  }
  el.innerHTML = upcoming.map(t => {
    const days = daysUntil(t.startDate);
    const isInProgress = t.startDate <= todayStr && t.endDate >= todayStr;
    const colour = TYPE_META[t.type]?.colour || '#666';
    return `
      <div class="upcoming-card" style="border-top-color:${colour}" onclick="openTripSheet('${t.id}')">
          <div class="uc-days" style="color:${colour}">${isInProgress ? 'Now' : days}</div>
          <div class="uc-days-lbl">${isInProgress ? 'In Progress' : 'Days Away'}</div>
          <div class="uc-dest">${t.title || t.destination || 'Untitled'}</div>
          <div class="uc-dates">${fmtDate(t.startDate)}</div>
          <div class="uc-type" style="color:${colour}">${(t.type || 'Leisure').toUpperCase()}</div>
        </div>`;
  }).join('');
}

function renderCalendar() {
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const trips = realTrips();
  
  for(let m=0; m<12; m++) {
    const month = document.createElement('div');
    month.className = 'cal-month';
    month.innerHTML = `<div class="cal-month-hdr">${months[m]}</div>`;
    
    const innerGrid = document.createElement('div');
    innerGrid.className = 'cal-grid';
    
    const firstDayIndex = new Date(currentYear, m, 1).getDay(); 
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
    
    for (let i = 0; i < startOffset; i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-day-blank';
      innerGrid.appendChild(blank);
    }

    for(let d=1; d<=daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const trip = trips.find(t => dateStr >= t.startDate && dateStr <= t.endDate);
      
      const dayEl = document.createElement('div');
      dayEl.className = 'cal-day';
      dayEl.innerHTML = `<span class="day-num">${d}</span>`;
      
      if (trip) {
        const isStart = dateStr === trip.startDate;
        const isEnd = dateStr === trip.endDate;
        
        if (isStart && isEnd) {
          dayEl.classList.add('is-single');
        } else if (isStart) {
          dayEl.classList.add('is-start');
        } else if (isEnd) {
          dayEl.classList.add('is-end');
        } else {
          dayEl.classList.add('is-middle');
        }
        
        const colour = TYPE_META[trip.type]?.colour || '#888';
        dayEl.style.setProperty('--trip-color', colour);
        dayEl.style.setProperty('--trip-bg', colour + '25'); 
        dayEl.style.cursor = 'pointer';
        dayEl.onclick = () => openTripSheet(trip.id);
      }
      
      innerGrid.appendChild(dayEl);
    }
    month.appendChild(innerGrid);
    grid.appendChild(month);
  }
}

function renderTripList() {
  const list = document.getElementById('tripList');
  list.innerHTML = realTrips().sort((a,b) => a.startDate.localeCompare(b.startDate)).map(t => {
    const colour = TYPE_META[t.type]?.colour || '#888';
    const iconName = TYPE_META[t.type]?.icon || 'mdi:map-marker';
    const currentStatus = deriveTripStatus(t.endDate, t.itinerary);
    const nights = nightsBetween(t.startDate, t.endDate);
    return `
    <div class="mobile-trip-row" onclick="openTripSheet('${t.id}')">
      <div class="mtr-icon" style="background:${colour}15;">
        ${getIconifyTag(iconName, 20, colour)}
      </div>
      <div class="mtr-info">
        <div class="mtr-title" style="color:${colour}">${t.title || t.destination || 'Untitled'}</div>
        <div class="mtr-date">${fmtDate(t.startDate)}${nights ? ` · ${nights} night${nights===1?'':'s'}` : ''}</div>
      </div>
      <div>
        <span class="status-badge status-${currentStatus.toLowerCase()}">${currentStatus}</span>
      </div>
    </div>`;
  }).join('');
}

function showTab(id) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
  
  document.getElementById('tab-'+id).classList.add('active');
  document.getElementById('tabBtn-'+id).classList.add('active');
}


function openTripSheet(id) {
  currentTrip = realTrips().find(t => t.id === id);
  if (!currentTrip) return;

  if (currentTrip.type === 'adventure') {
    renderTrekSheet();
    return;
  }

  const sheet = document.getElementById('iosSheet');
  const meta = TYPE_META[currentTrip.type] || {};
  const colour = meta.colour || '#888';
  
  const tripNotesWidgetHtml = currentTrip.notes ? `
    <div class="ios-trip-notes-widget">
      <div style="margin-top:1px;">${getIconifyTag('mdi:note-text-outline', 16, '#ffcc00')}</div>
      <div class="ios-trip-notes-text">${currentTrip.notes}</div>
    </div>
  ` : '';

  const tripNights = nightsBetween(currentTrip.startDate, currentTrip.endDate);
  const tripDays = tripNights !== null ? tripNights + 1 : null;
  
  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="closeSheet()">Close</button>
      <div class="ios-nav-title">${currentTrip.title || currentTrip.destination || 'Trip Details'}</div>
      <button class="ios-link-btn bold" onclick="openTripForm('${currentTrip.id}')">Edit</button>
    </div>

    <div class="ios-hero-banner" style="background: linear-gradient(135deg, ${colour}, var(--app-primary));">
      <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">${meta.label || currentTrip.type}</div>
      <div style="font-size:20px; font-weight:800; margin:2px 0;">${currentTrip.title || currentTrip.destination}</div>
      <div style="font-size:12px; opacity:0.9;">${fmtDate(currentTrip.startDate)} — ${fmtDate(currentTrip.endDate)}${tripDays ? ` · ${tripDays} day${tripDays===1?'':'s'}` : ''}</div>
    </div>

    ${tripNotesWidgetHtml}

    <div class="ios-sheet-body" id="subTabContent"></div>

    <!-- PREMIUM 4-BUTTON iOS STICKY BOTTOM NAVIGATION BAR -->
    <div class="ios-bottom-nav">
      <button class="ios-tab-btn ${activeSubTab==='itinerary'?'active':''}" onclick="switchSubTab('itinerary')">
        <iconify-icon icon="mdi:map-marker-path"></iconify-icon>
        <span>Itinerary</span>
      </button>
      <button class="ios-tab-btn ${activeSubTab==='lingo'?'active':''}" onclick="switchSubTab('lingo')">
        <iconify-icon icon="mdi:translate"></iconify-icon>
        <span>Lingo</span>
      </button>
      <button class="ios-tab-btn ${activeSubTab==='ideas'?'active':''}" onclick="switchSubTab('ideas')">
        <iconify-icon icon="mdi:lightbulb-outline"></iconify-icon>
        <span>Ideas</span>
      </button>
      <button class="ios-tab-btn ${activeSubTab==='add'?'active':''}" onclick="switchSubTab('add')">
        <iconify-icon icon="mdi:plus-circle-outline"></iconify-icon>
        <span>Add</span>
      </button>
    </div>
  `;
  
  document.getElementById('iosOverlay').style.display = 'flex';
  renderSubTab();
}


function switchSubTab(target) {
  activeSubTab = target;
  document.querySelectorAll('.ios-tab-btn').forEach(b => b.classList.remove('active'));
  renderSubTab();
  
  const btns = document.querySelectorAll('.ios-tab-btn');
  btns.forEach(btn => {
    if(btn.getAttribute('onclick').includes(`'${target}'`)) {
      btn.classList.add('active');
    }
  });
}

function renderSubTab() {
  const container = document.getElementById('subTabContent');
  const items = currentTrip.itinerary || [];
  
  // 1. ADD NEW ITEM PANEL VIEW
  if (activeSubTab === 'add') {
    container.innerHTML = `
      <div class="ios-group-title">Tap an item type to add</div>
      <div class="add-grid">
        ${Object.entries(ITEM_ICONS).map(([type, d]) => `
          <div class="add-tile" onclick="openActivityForm(-1, '${type}')">
            <div class="add-tile-icon" style="background:${d.bg};">${getIconifyTag(d.icon, 22, d.color)}</div>
            <div class="add-tile-lbl">${d.lbl}</div>
          </div>
        `).join('')}
      </div>
    `;
    return;
  }

  // 2. EXCLUSIVE LOCAL LINGO MODULE COCKPIT
  if (activeSubTab === 'lingo') {
    const lingoItems = items.filter(i => i.type === 'lingo');
    if (lingoItems.length === 0) {
      container.innerHTML = `
        <p style="text-align:center; color:#8e8e93; margin-top:40px; font-size:14px;">No language phrases saved yet.</p>
        <div style="text-align:center; margin-top: 15px;">
           <button class="ios-btn-primary" style="display:inline-flex; width:auto; padding:8px 16px;" onclick="openActivityForm(-1, 'lingo')">Add Phrase</button>
        </div>`;
      return;
    }
    container.innerHTML = `<div class="ios-group-title">Local Lingo & Expressions</div>` + lingoItems.map(item => buildItemRowMarkup(item)).join('');
    return;
  }

  // 3. DATALINKED SUBTAB SEGMENT FILTERS (Lingo items are clean-filtered out to prevent double-rendering)
  const matches = items.filter(i => {
    if (i.type === 'lingo') return false; 
    return activeSubTab === 'itinerary' ? !!i.date : !i.date;
  });
  
  if (matches.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:#8e8e93; margin-top:40px; font-size:14px;">Empty section.</p>`;
    return;
  }

  if (activeSubTab === 'itinerary') {
    function itemSortKey(item) {
      const date = item.date || '';
      let time = item.time || '';
      if (!time && item.type === 'transit' && item.legs && item.legs.length > 0) {
        time = item.legs[0].depart || '';
      }
      return date + time;
    }
    matches.sort((a, b) => itemSortKey(a).localeCompare(itemSortKey(b)));
    let html = '';
    let lastDate = '';
    matches.forEach(item => {
      if (item.date !== lastDate) {
        lastDate = item.date;
        html += `<div class="ios-group-title" id="day-${item.date}">${fmtDate(item.date)}</div>`;
      }
      html += buildItemRowMarkup(item);
    });
    container.innerHTML = html;
    scrollToToday(container);
  } else {
    container.innerHTML = `<div class="ios-group-title">Saved Ideas</div>` + matches.map(item => buildItemRowMarkup(item)).join('');
  }
}


function closeSheet() {
  document.getElementById('iosOverlay').style.display = 'none';
  currentTrip = null;
}

/* ── IDEA BANK LIBRARY ──
   A cross-trip collection of favourite accommodation / food / drink
   / sight-seeing entries, grouped by destination. Items become
   library entries when their heart toggle is switched on inside a
   trip; new trips are auto-seeded with any library entries that
   match their destination string (case/whitespace-insensitive). */

function openTripForm(id) {
  const sheet = document.getElementById('iosSheet');
  const isNew = !id;
  const trip = isNew ? { id:'trp_'+Date.now(), title:'', destination:'', type:'leisure', startDate:'', endDate:'', notes:'', itinerary:[] } : realTrips().find(t => t.id === id);

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="${isNew ? 'closeSheet()' : `openTripSheet('${id}')`}">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Trip' : 'Trip Settings'}</div>
      <button class="ios-link-btn bold" onclick="saveTripLevel('${trip.id}', ${isNew})">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Essential Metadata</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Title</label>
          <input type="text" id="editTripTitle" class="ios-input" placeholder="Summer Getaway" value="${trip.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Destination</label>
          <input type="text" id="editTripDest" class="ios-input" placeholder="City, Country" list="knownDestinations" value="${trip.destination || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Category</label>
          <select id="editTripType" class="ios-select">
            ${Object.entries(TYPE_META).map(([k, v]) => `<option value="${k}" ${trip.type===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="ios-group-title">Timeline</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Start Date</label>
          <input type="date" id="editTripStart" class="ios-input" value="${trip.startDate || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">End Date</label>
          <input type="date" id="editTripEnd" class="ios-input" value="${trip.endDate || ''}">
        </div>
      </div>

      ${notesGroupHtml('General Notes', 'editTripNotes', 'Pack light, checklist metrics...', trip.notes)}

      ${dangerFooterHtml(isNew, `deleteTripRaw('${trip.id}')`, 'Delete Entire Trip')}
    </div>
  `;
  document.getElementById('iosOverlay').style.display = 'flex';
}

function saveTripLevel(id, isNew) {
  const tTitle = document.getElementById('editTripTitle').value;
  const tDest = document.getElementById('editTripDest').value;
  const tType = document.getElementById('editTripType').value;
  const tStart = document.getElementById('editTripStart').value;
  const tEnd = document.getElementById('editTripEnd').value;
  const tNotes = document.getElementById('editTripNotes').value;

  if (isNew) {
    const newObj = { id, title: tTitle, destination: tDest, type: tType, startDate: tStart, endDate: tEnd, notes: tNotes, itinerary: [] };
    seedIdeaBankIntoTrip(newObj);
    seedLingoFromLibrary(newObj);
    newObj.status = deriveTripStatus(tEnd, newObj.itinerary);
    DATA.trips.push(newObj);
  } else {
    const idx = DATA.trips.findIndex(t => t.id === id);
    if (idx !== -1) {
      DATA.trips[idx].title = tTitle;
      DATA.trips[idx].destination = tDest;
      DATA.trips[idx].type = tType;
      DATA.trips[idx].startDate = tStart;
      DATA.trips[idx].endDate = tEnd;
      DATA.trips[idx].notes = tNotes;
      seedLingoFromLibrary(DATA.trips[idx]);
      DATA.trips[idx].status = deriveTripStatus(tEnd, DATA.trips[idx].itinerary);
    }
  }

  persistLocal();
  updateCountBadge();
  render();
  openTripSheet(id);
  triggerGitHubAutoSync();
}

function deleteTripRaw(id) {
  if (confirm("Delete this trip?")) {
    DATA.trips = realTrips().filter(t => t.id !== id);
    persistLocal();
    updateCountBadge();
    render();
    closeSheet();
    triggerGitHubAutoSync();
  }
}

/* ── BESPOKE FOOD ITEM FORM ──
   Reservation toggle reveals time + confirmation ref, mirroring the
   trek booking pattern. Keeps the same itinerary item shape (type,
   status, title, date, time, location, notes, details) so it stays
   fully compatible with the generic itinerary list and filters. */
/* Shared by every per-item dedicated form below: flipping this
   switch clears & disables the date (and time, if present) so the
   item lands in the trip's date-less "Ideas" sub-tab instead of the
   scheduled itinerary — exactly the same mechanism a date-less
   Idea Bank import or a manually-added idea uses, so both flavours
   of "idea" show up side by side in that tab. */
function toggleIdeaDateFields(chk, dateId, timeId) {
  const dateEl = document.getElementById(dateId);
  const timeEl = timeId ? document.getElementById(timeId) : null;
  if (chk.checked) {
    if (dateEl) dateEl.disabled = true;
    if (timeEl) timeEl.disabled = true;
  } else {
    if (dateEl) { dateEl.disabled = false; if (!dateEl.value && currentTrip) dateEl.value = currentTrip.startDate || ''; }
    if (timeEl) timeEl.disabled = false;
  }
}

/* ── SHARED FORM MARKUP HELPERS ──
   These three blocks repeat near-verbatim across food / sightseeing /
   accommodation / activity / note / lingo / journey forms below — only
   element ids, labels and placeholders change between them. Templating
   them keeps each open*Form function focused on the fields that are
   actually specific to that item type. */

/** The "Save to Trip Ideas (no date yet)" switch row that appears at
 *  the top of every dated item's form. fieldB is optional (e.g.
 *  accommodation passes its check-out field instead of a time field —
 *  toggleIdeaDateFields just disables whichever second field it gets). */
function ideaToggleRowHtml(toggleId, fieldA, fieldB, label, isIdea) {
  return `
        <div class="ios-row ios-row-between">
          <label class="ios-label">${label}</label>
          <label class="ios-switch">
            <input type="checkbox" id="${toggleId}" ${isIdea ? 'checked' : ''} onchange="toggleIdeaDateFields(this,'${fieldA}','${fieldB || ''}')">
            <span class="ios-slider"></span>
          </label>
        </div>`;
}

/** A titled notes/free-text group — the same "ios-group-title + single
 *  textarea" shape used by every form's Notes section (and a couple of
 *  other free-text fields like the lingo phrase list). */
function notesGroupHtml(groupTitle, fieldId, placeholder, value, extraStyle = '') {
  return `
      <div class="ios-group-title">${groupTitle}</div>
      <div class="ios-group">
        <div class="ios-row vertical">
          <textarea id="${fieldId}" class="ios-textarea"${extraStyle ? ` style="${extraStyle}"` : ''} placeholder="${placeholder}">${value || ''}</textarea>
        </div>
      </div>`;
}

/** The "Remove Item" danger button pinned to the bottom of every
 *  edit form — omitted entirely when isNew (nothing to remove yet). */
function removeItemFooterHtml(index, isNew, deleteFn = 'deleteActivityRaw', label = 'Remove Item') {
  if (isNew) return '';
  return `
      <div class="ios-danger-block">
        <button class="ios-link-btn danger bold ios-danger-btn" onclick="${deleteFn}(${index})">${label}</button>
      </div>`;
}

/** Same danger-button footer as removeItemFooterHtml, but for the two
 *  callers (library entry, trip-level) whose delete action isn't a
 *  simple deleteFn(index) — takes the literal onclick string instead. */
function dangerFooterHtml(isNew, onclickStr, label) {
  if (isNew) return '';
  return `
      <div class="ios-danger-block">
        <button class="ios-link-btn danger bold ios-danger-btn" onclick="${onclickStr}">${label}</button>
      </div>`;
}


function toggleFieldVisibility(chk, ...rules) {
  rules.forEach(([id, shownDisplay, hiddenDisplay = 'none']) => {
    const el = document.getElementById(id);
    if (el) el.style.display = chk.checked ? shownDisplay : hiddenDisplay;
  });
}

function triggerGitHubAutoSync() {
  return syncToGitHub(GITHUB_CONFIG, buildExportPayload);
}

function exportJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(buildExportPayload(), null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `wanderer_local_backup_${currentYear}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
/* ── SCROLL-TO-TODAY + JUMP BUTTON ─────────────────────────────────
   Called after renderSubTab() and renderTrekStageList() to:
   1. Auto-scroll #subTabContent to today's (or next future) day section
   2. Inject a floating "↓ Today" pill that re-scrolls on demand and
      hides itself once the today section is in view. */
function scrollToToday(container) {
  const today = new Date().toISOString().split('T')[0];
  if (!currentTrip || today < currentTrip.startDate || today > currentTrip.endDate) return;

  // Find the anchor for today, or the first future date if today isn't present
  function findBestAnchor() {
    // Collect all day-* ids in DOM order
    const anchors = Array.from(container.querySelectorAll('[id^="day-"]'));
    if (!anchors.length) return null;

    // Exact match first
    const exact = container.querySelector(`#day-${today}`);
    if (exact) return exact;

    // Next future date
    return anchors.find(el => {
      const date = el.id.replace('day-', '');
      return date >= today;
    }) || null;
  }

  const anchor = findBestAnchor();
  if (!anchor) return;   // trip is entirely in the past — stay at top

  // Scroll the sheet body to the anchor, with a small top margin
  requestAnimationFrame(() => {
    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + (anchorRect.top - containerRect.top) - 12,
      behavior: 'smooth'
    });
  });

  // ── Jump button ──────────────────────────────────────────────────
  // Remove any leftover button from a previous render
  const sheet = document.getElementById('iosSheet');
  document.getElementById('_jumpTodayBtn')?.remove();

  const btn = document.createElement('button');
  btn.id = '_jumpTodayBtn';
  btn.textContent = '↓ Today';
  btn.style.cssText = `
    position: absolute; bottom: 72px; left: 50%; transform: translateX(-50%);
    background: var(--app-accent); color: #fff;
    border: none; border-radius: 20px;
    padding: 7px 18px; font-size: 12px; font-weight: 700;
    font-family: inherit; cursor: pointer;
    box-shadow: 0 3px 12px rgba(0,122,255,0.35);
    z-index: 500; opacity: 0; transition: opacity .2s;
    pointer-events: none; white-space: nowrap;
  `;

  // The sheet needs position:relative for absolute child to work
  if (getComputedStyle(sheet).position === 'static') {
    sheet.style.position = 'relative';
  }
  sheet.appendChild(btn);

  btn.addEventListener('click', () => {
    const a = findBestAnchor();
    if (!a) return;
    const containerRect = container.getBoundingClientRect();
    const anchorRect = a.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + (anchorRect.top - containerRect.top) - 12,
      behavior: 'smooth'
    });
  });

  // Show/hide based on whether the anchor is visible in the scroll container
  function updateButtonVisibility() {
    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const isVisible = anchorRect.top >= containerRect.top && anchorRect.top < containerRect.bottom;
    btn.style.opacity = isVisible ? '0' : '1';
    btn.style.pointerEvents = isVisible ? 'none' : 'auto';
  }

  // Initial check (after scroll lands)
  setTimeout(updateButtonVisibility, 400);
  container.addEventListener('scroll', updateButtonVisibility, { passive: true });
  // Clean up listener when the sheet is closed
  const origClose = window.closeSheet;
  window.closeSheet = function() {
    container.removeEventListener('scroll', updateButtonVisibility);
    window.closeSheet = origClose;
    origClose();
  };
}

document.addEventListener('DOMContentLoaded', loadData);
