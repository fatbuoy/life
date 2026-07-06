/**
 * SAHANI SUITE — travel-planner: library.js
 * Idea Bank (cross-trip favourites) and Lingo Library subsystem.
 * Depends on: core.js (DATA, persistLocal, render, TYPE_META,
 * IDEA_BANK_CATEGORIES) and itinerary.js (buildItemRowMarkup, for the
 * date-less Ideas sub-tab rendering).
 */
'use strict';

function normDest(s) { return (s || '').trim().toLowerCase(); }

function extractCountry(destination) {
  if (!destination) return '';
  const parts = destination.split(',');
  return parts[parts.length - 1].trim();
}

function upsertIdeaBankEntry(item, category) {
  if (!DATA.ideaBank) DATA.ideaBank = [];
  const destNorm = normDest(currentTrip.destination);
  const titleNorm = (item.title || '').trim().toLowerCase();
  let existing = DATA.ideaBank.find(e => normDest(e.destination) === destNorm && e.category === category && e.title.trim().toLowerCase() === titleNorm);

  if (existing) {
    existing.title = item.title || existing.title;
    existing.location = item.location || '';
    existing.notes = item.notes || '';
    return existing.id;
  }

  const id = 'idea-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  DATA.ideaBank.push({
    id,
    destination: currentTrip.destination,
    category,
    title: item.title || '',
    location: item.location || '',
    notes: item.notes || '',
    addedAt: new Date().toISOString(),
    sourceTripId: currentTrip.id
  });
  return id;
}

function toggleItemFavourite(idx) {
  const item = currentTrip.itinerary[idx];
  item.favourite = !item.favourite;
  if (item.favourite) {
    item.libraryId = upsertIdeaBankEntry(item, item.type);
  }
  const masterIdx = DATA.trips.findIndex(t => t.id === currentTrip.id);
  DATA.trips[masterIdx].itinerary = currentTrip.itinerary;
  persistLocal();
  renderSubTab();
  renderLibraryTab();
  triggerGitHubAutoSync();
}

/* Seeds a brand-new trip's itinerary (as date-less "idea" items) with
   any Idea Bank entries matching its destination. Only ever called
   for newly-created trips, so editing an existing trip's destination
   later won't repeatedly re-merge the library back in. */
function seedIdeaBankIntoTrip(trip) {
  if (!DATA.ideaBank || !DATA.ideaBank.length) return;
  const destNorm = normDest(trip.destination);
  if (!destNorm) return;
  const matches = DATA.ideaBank.filter(e => normDest(e.destination) === destNorm);
  if (!matches.length) return;

  if (!trip.itinerary) trip.itinerary = [];
  const existingKeys = new Set(trip.itinerary.map(i => i.type + '::' + (i.title || '').trim().toLowerCase()));

  matches.forEach(entry => {
    const key = entry.category + '::' + entry.title.trim().toLowerCase();
    if (existingKeys.has(key)) return;
    trip.itinerary.push({
      id: 'it-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      type: entry.category,
      status: entry.category === 'accommodation' ? 'not-booked' : 'no-booking-required',
      title: entry.title,
      date: '', time: '',
      location: entry.location || '',
      notes: entry.notes || '',
      details: { pnr: '' },
      favourite: true,
      libraryId: entry.id,
      fromLibrary: true
    });
    existingKeys.add(key);
  });
}

/* Seeds Local Lingo entries for a trip's country from the Lingo
   Library, skipping any occasion the trip already has (and skipping
   any library occasion with no phrases yet). Safe to call on every
   trip save, new or edited — it never duplicates or overwrites. */
function seedLingoFromLibrary(trip) {
  const country = extractCountry(trip.destination);
  const lib = DATA.lingoLibrary && DATA.lingoLibrary[country];
  if (!lib) return;

  if (!trip.itinerary) trip.itinerary = [];
  const existingOccasions = new Set(trip.itinerary.filter(i => i.type === 'lingo').map(i => i.occasion));

  Object.entries(lib).forEach(([occasion, entry]) => {
    if (existingOccasions.has(occasion)) return;
    if (!entry || !entry.phrases) return;
    trip.itinerary.push({
      id: 'it-' + Date.now() + '-' + occasion,
      type: 'lingo', status: 'no-booking-required',
      occasion, title: entry.title || LINGO_OCCASIONS[occasion] || occasion,
      phrases: entry.phrases, notes: '', details: {}
    });
    existingOccasions.add(occasion);
  });
}

function updateKnownDestinationsList() {
  const dl = document.getElementById('knownDestinations');
  if (!dl) return;
  const dests = new Set();
  realTrips().forEach(t => { if (t.destination) dests.add(t.destination); });
  (DATA.ideaBank || []).forEach(e => { if (e.destination) dests.add(e.destination); });
  dl.innerHTML = Array.from(dests).sort().map(d => `<option value="${d}"></option>`).join('');
}

function setLibraryFilter(filter) {
  libraryFilter = filter;
  renderLibraryTab();
}

function onLibrarySearchInput(value) {
  librarySearch = value.trim().toLowerCase();
  renderLibraryTab();
}

function toggleLibraryGroup(headerEl) {
  const body = headerEl.nextElementSibling;
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

const LIB_CATEGORY_LABELS = { accommodation: 'Accommodation', food: 'Restaurants, Food & Drink', sightseeing: 'Sight-Seeing' };

function renderLibraryTab() {
  const container = document.getElementById('libraryList');
  if (!container) return;

  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('libFilter-' + libraryFilter);
  if (activeBtn) activeBtn.classList.add('active');

  let entries = DATA.ideaBank || [];
  if (libraryFilter !== 'all') entries = entries.filter(e => e.category === libraryFilter);
  if (librarySearch) {
    entries = entries.filter(e =>
      (e.destination || '').toLowerCase().includes(librarySearch) ||
      (e.title || '').toLowerCase().includes(librarySearch)
    );
  }

  if (entries.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:50px 20px;">
      ${getIconifyTag('mdi:lightbulb-on-outline', 36, '#c7c7cc')}
      <p style="color:#8e8e93; margin-top:10px; font-size:14px;">No saved ideas yet.<br>Heart an accommodation, food or sight-seeing entry in any trip to save it here, or tap "Add Idea" above.</p>
    </div>`;
    return;
  }

  const byDest = {};
  entries.forEach(e => {
    if (!byDest[e.destination]) byDest[e.destination] = [];
    byDest[e.destination].push(e);
  });

  container.innerHTML = Object.keys(byDest).sort().map(dest => {
    const items = byDest[dest];
    const byCat = { accommodation: [], food: [], sightseeing: [] };
    items.forEach(e => { if (byCat[e.category]) byCat[e.category].push(e); });

    const catBlocksHtml = Object.entries(byCat).map(([cat, list]) => {
      if (!list.length) return '';
      return `
        <div class="lib-cat-lbl">${LIB_CATEGORY_LABELS[cat]}</div>
        ${list.map(e => `
          <div class="lib-entry-row">
            <div style="flex-grow:1; min-width:0;">
              <div class="lib-entry-title">${e.title}</div>
              ${e.location ? `<div class="lib-entry-sub">${e.location}</div>` : ''}
            </div>
            <div class="lib-entry-actions">
              <button class="lib-action-btn lib-action-btn-edit" onclick="openLibraryEntryForm('${e.id}')">Edit</button>
              <button class="lib-action-btn lib-action-btn-delete" onclick="deleteLibraryEntry('${e.id}')">Delete</button>
            </div>
          </div>
        `).join('')}
      `;
    }).join('');

    return `
      <div class="lib-dest-group">
        <div class="lib-dest-hdr" onclick="toggleLibraryGroup(this)">
          <div class="lib-dest-name">${dest}</div>
          <span class="lib-dest-count">${items.length}</span>
          <button class="lib-share-btn" onclick="event.stopPropagation(); exportIdeaBankCity('${dest.replace(/'/g, "\\'")}')">${getIconifyTag('mdi:share-variant-outline', 13, 'var(--app-accent)')} Share</button>
        </div>
        <div class="lib-dest-body">
          ${catBlocksHtml}
        </div>
      </div>
    `;
  }).join('');
}

function exportIdeaBankCity(destination) {
  const entries = (DATA.ideaBank || []).filter(e => e.destination === destination);
  if (!entries.length) return;

  const byCat = { accommodation: [], food: [], sightseeing: [] };
  entries.forEach(e => { if (byCat[e.category]) byCat[e.category].push(e); });

  let text = `${destination} — Saved Ideas\n${'='.repeat(destination.length + 14)}\n\n`;
  Object.entries(byCat).forEach(([cat, list]) => {
    if (!list.length) return;
    text += `${LIB_CATEGORY_LABELS[cat]}\n`;
    list.forEach(e => {
      text += `• ${e.title}${e.location ? ' — ' + e.location : ''}\n`;
      if (e.notes) text += `  ${e.notes.replace(/\n/g, '\n  ')}\n`;
    });
    text += `\n`;
  });

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `${destination.replace(/[^a-z0-9]+/gi, '_')}_ideas.txt`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  alert(`Saved ideas for ${destination} copied to clipboard and downloaded as a text file — ready to share.`);
}

function deleteLibraryEntry(id) {
  if (!confirm("Remove this idea from your library?")) return;
  DATA.ideaBank = (DATA.ideaBank || []).filter(e => e.id !== id);
  persistLocal();
  renderLibraryTab();
  triggerGitHubAutoSync();
}

/* Add/Edit form for a library entry, used both for entries created
   directly from the Library tab and for editing an existing one. */
function openLibraryEntryForm(id) {
  const sheet = document.getElementById('iosSheet');
  const isNew = !id;
  const entry = isNew
    ? { id: null, destination: '', category: 'sightseeing', title: '', location: '', notes: '' }
    : DATA.ideaBank.find(e => e.id === id);
  if (!entry) return;

  sheet.innerHTML = `
    <div class="ios-nav-bar">
      <button class="ios-link-btn" onclick="closeSheet(); renderLibraryTab();">Cancel</button>
      <div class="ios-nav-title">${isNew ? 'New Idea' : 'Edit Idea'}</div>
      <button class="ios-link-btn bold" onclick="saveLibraryEntryLevel('${id || ''}')">Done</button>
    </div>
    <div class="ios-sheet-body">
      <div class="ios-group-title">Idea</div>
      <div class="ios-group">
        <div class="ios-row">
          <label class="ios-label">Destination</label>
          <input type="text" id="libDest" class="ios-input" placeholder="City, Country" list="knownDestinations" value="${entry.destination || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">Category</label>
          <select id="libCategory" class="ios-select">
            ${IDEA_BANK_CATEGORIES.map(c => `<option value="${c}" ${entry.category===c?'selected':''}>${LIB_CATEGORY_LABELS[c]}</option>`).join('')}
          </select>
        </div>
        <div class="ios-row">
          <label class="ios-label">Title / Name</label>
          <input type="text" id="libTitle" class="ios-input" placeholder="e.g. Sorbillo" value="${entry.title || ''}">
        </div>
        <div class="ios-row">
          <label class="ios-label">${entry.category === 'accommodation' ? 'Address' : 'Location'}</label>
          <input type="text" id="libLocation" class="ios-input" placeholder="Address or area" value="${entry.location || ''}">
        </div>
      </div>

      ${notesGroupHtml('Notes', 'libNotes', 'What makes it worth coming back to...', entry.notes)}

      ${dangerFooterHtml(isNew, `closeSheet(); deleteLibraryEntry('${id}');`, 'Remove from Library')}
    </div>
  `;
  document.getElementById('iosOverlay').style.display = 'flex';
}

function saveLibraryEntryLevel(id) {
  const destination = document.getElementById('libDest').value.trim();
  const category = document.getElementById('libCategory').value;
  const title = document.getElementById('libTitle').value.trim();
  const location = document.getElementById('libLocation').value.trim();
  const notes = document.getElementById('libNotes').value;

  if (!destination || !title) {
    alert("Please enter at least a destination and a title.");
    return;
  }

  if (!DATA.ideaBank) DATA.ideaBank = [];
  if (id) {
    const existing = DATA.ideaBank.find(e => e.id === id);
    if (existing) Object.assign(existing, { destination, category, title, location, notes });
  } else {
    DATA.ideaBank.push({
      id: 'idea-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      destination, category, title, location, notes,
      addedAt: new Date().toISOString(), sourceTripId: null
    });
  }

  persistLocal();
  renderLibraryTab();
  updateKnownDestinationsList();
  closeSheet();
  triggerGitHubAutoSync();
}