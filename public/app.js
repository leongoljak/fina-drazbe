// FINA Dražbe Plus - Frontend Application
document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    listings: [],
    status: null,
    currentTab: 'all', // 'all' | 'favorites'
    selectedCounties: new Set(),
    selectedType: 'all',
    searchQuery: '',
    sortBy: 'deadline_asc',
    favorites: new Set(loadFavorites())
  };

  // DOM Elements
  const listingsGrid = document.getElementById('listingsGrid');
  const countAll = document.getElementById('countAll');
  const countFav = document.getElementById('countFav');
  const tabAll = document.getElementById('tabAll');
  const tabFavorites = document.getElementById('tabFavorites');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const countyDropdownBtn = document.getElementById('countyDropdownBtn');
  const countyDropdownMenu = document.getElementById('countyDropdownMenu');
  const countyDropdownLabel = document.getElementById('countyDropdownLabel');
  const countySelectedCount = document.getElementById('countySelectedCount');
  const countyCheckboxes = document.getElementById('countyCheckboxes');
  const applyCountiesBtn = document.getElementById('applyCountiesBtn');
  const sortSelect = document.getElementById('sortSelect');
  const typeChips = document.getElementById('typeChips');
  const activeTagsBar = document.getElementById('activeTagsBar');
  const activeTagsList = document.getElementById('activeTagsList');
  const resetAllFiltersBtn = document.getElementById('resetAllFiltersBtn');
  const resultsCounter = document.getElementById('resultsCounter');
  const resultsTitle = document.getElementById('resultsTitle');
  const activeFiltersSummary = document.getElementById('activeFiltersSummary');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const emptyFavoritesState = document.getElementById('emptyFavoritesState');
  const resetFromEmptyBtn = document.getElementById('resetFromEmptyBtn');
  const browseFromFavBtn = document.getElementById('browseFromFavBtn');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const refreshBtn = document.getElementById('refreshBtn');

  // Modal Elements
  const detailModal = document.getElementById('detailModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalFavBtn = document.getElementById('modalFavBtn');
  const modalBadges = document.getElementById('modalBadges');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalBody = document.getElementById('modalBody');
  const modalCourtBadge = document.getElementById('modalCourtBadge');
  const modalFinaLink = document.getElementById('modalFinaLink');
  const modalPismenaLink = document.getElementById('modalPismenaLink');
  const toast = document.getElementById('toast');

  let activeModalListing = null;

  // Counties Presets
  const COUNTY_PRESETS = {
    zagreb: ['Grad Zagreb', 'Zagrebačka'],
    jadran: ['Istarska', 'Primorsko-goranska', 'Zadarska', 'Šibensko-kninska', 'Splitsko-dalmatinska', 'Dubrovačko-neretvanska'],
    slavonija: ['Osječko-baranjska', 'Vukovarsko-srijemska', 'Brodsko-posavska', 'Požeško-slavonska', 'Virovitičko-podravska']
  };

  // Initialize
  init();

  async function init() {
    setupEventListeners();
    updateFavoritesBadge();
    await fetchStatus();
    await fetchListings();
  }

  // --- API Functions ---
  async function fetchStatus() {
    try {
      let res = await fetch('/api/status');
      if (res.ok) {
        state.status = await res.json();
      } else {
        res = await fetch('./data/status.json');
        if (res.ok) state.status = await res.json();
      }
      renderStatusInfo();
      renderCountyCheckboxes();
    } catch (e) {
      try {
        const res = await fetch('./data/status.json');
        if (res.ok) {
          state.status = await res.json();
          renderStatusInfo();
          renderCountyCheckboxes();
        }
      } catch (_) {}
    }
  }

  async function fetchListings() {
    showLoading(true);
    try {
      let res = await fetch('/api/listings');
      let data = null;
      if (res.ok) {
        data = await res.json();
      } else {
        res = await fetch('./data/listings.json');
        if (res.ok) {
          const raw = await res.json();
          data = { total: raw.length, listings: raw };
        }
      }
      if (data) {
        state.listings = data.listings || [];
        countAll.textContent = state.listings.length;
        renderListings();
      }
    } catch (e) {
      try {
        const res = await fetch('./data/listings.json');
        if (res.ok) {
          const raw = await res.json();
          state.listings = raw || [];
          countAll.textContent = state.listings.length;
          renderListings();
          return;
        }
      } catch (_) {}
      console.error('Error fetching listings:', e);
      showToast('Greška pri dohvaćanju oglasa');
    } finally {
      showLoading(false);
    }
  }

  async function syncListings() {
    const isStaticHost = window.location.hostname.includes('netlify.app') || 
                         window.location.hostname.includes('github.io') || 
                         window.location.protocol === 'file:';

    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;

    if (isStaticHost) {
      showToast('Osvježavanje na Netlifyju nije moguće jer je to statički hosting.');
      setTimeout(() => {
        alert(
          "ℹ️ Objašnjenje zašto na Netlifyju nema osvježavanja:\n\n" +
          "Netlify Drop je besplatan statički hosting (samo prikazuje spremljene datoteke i nema vlastiti poslužitelj koji bi se mogao spojiti na FINA-u u pozadini).\n\n" +
          "💡 Kako ažurirati podatke:\n" +
          "1. Na svom računalu pokreni skriptu za osvježavanje i novu mapu prebaci na Netlify, ILI\n" +
          "2. Postavi aplikaciju na besplatan cloud poslužitelj (poput Render.com) gdje poslužitelj radi 24/7 i sam osvježava podatke na gumb!"
        );
      }, 500);
      refreshBtn.classList.remove('loading');
      refreshBtn.disabled = false;
      return;
    }

    showToast('Osvježavam podatke s FINA-e... Ovo traje 10-15 sekundi.');

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        // Poll status until sync finishes
        let attempts = 0;
        const checkInterval = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await fetch('/api/status');
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (!statusData.is_syncing || attempts > 60) {
                clearInterval(checkInterval);
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;

                if (statusData.sync_error) {
                  showToast('Greška pri osvježavanju: ' + statusData.sync_error);
                } else {
                  showToast(`Uspješno osvježeno! Aktivnih dražbi: ${statusData.total_count || ''} 🎉`);
                  await fetchStatus();
                  await fetchListings();
                }
              }
            }
          } catch (_) {
            clearInterval(checkInterval);
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
          }
        }, 1500);
      } else {
        showToast('Nije uspjelo osvježavanje podataka.');
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
      }
    } catch (e) {
      showToast('Greška pri spajanju na poslužitelj.');
      refreshBtn.classList.remove('loading');
      refreshBtn.disabled = false;
    }
  }

  // --- Favorites Management ---
  function loadFavorites() {
    try {
      const saved = localStorage.getItem('fina_fav_uuids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites() {
    localStorage.setItem('fina_fav_uuids', JSON.stringify(Array.from(state.favorites)));
    updateFavoritesBadge();
  }

  function toggleFavorite(uuid, e) {
    if (e) e.stopPropagation();
    if (state.favorites.has(uuid)) {
      state.favorites.delete(uuid);
      showToast('Uklonjeno iz omiljenih');
    } else {
      state.favorites.add(uuid);
      showToast('Dodano u omiljene! ⭐');
    }
    saveFavorites();
    updateCardFavIcons(uuid);

    if (activeModalListing && activeModalListing.uuid === uuid) {
      updateModalFavBtn();
    }

    if (state.currentTab === 'favorites') {
      renderListings();
    }
  }

  function updateFavoritesBadge() {
    countFav.textContent = state.favorites.size;
  }

  function updateCardFavIcons(uuid) {
    document.querySelectorAll(`.fav-btn[data-uuid="${uuid}"]`).forEach(btn => {
      const isFav = state.favorites.has(uuid);
      btn.classList.toggle('is-fav', isFav);
      btn.innerHTML = `<i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
    });
  }

  function updateModalFavBtn() {
    if (!activeModalListing) return;
    const isFav = state.favorites.has(activeModalListing.uuid);
    modalFavBtn.classList.toggle('is-fav', isFav);
    modalFavBtn.innerHTML = `
      <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
      <span>${isFav ? 'Spremljeno u omiljeno' : 'Spremi oglas'}</span>
    `;
  }

  // --- Filtering & Sorting ---
  function getFilteredListings() {
    let result = [...state.listings];

    // Tab filter
    if (state.currentTab === 'favorites') {
      result = result.filter(item => state.favorites.has(item.uuid));
    }

    // Multi-County Filter
    if (state.selectedCounties.size > 0) {
      result = result.filter(item => state.selectedCounties.has(item.zupanija));
    }

    // Property Type Filter
    if (state.selectedType !== 'all') {
      result = result.filter(item => item.glavnaVrsta === state.selectedType);
    }

    // Search Query Filter
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      result = result.filter(item => {
        const text = [
          item.glavniGrad,
          item.glavnaAdresa,
          item.poslovniBroj,
          item.sud,
          item.zupanija,
          item.glavnaVrsta,
          item.opis
        ].filter(Boolean).join(' ').toLowerCase();

        return text.includes(q);
      });
    }

    // Sorting
    switch (state.sortBy) {
      case 'price_asc':
        result.sort((a, b) => (a.pocetnaCijena || 0) - (b.pocetnaCijena || 0));
        break;
      case 'price_desc':
        result.sort((a, b) => (b.pocetnaCijena || 0) - (a.pocetnaCijena || 0));
        break;
      case 'deadline_desc':
        result.sort((a, b) => (b.preostaloDanaJamcevina || 0) - (a.preostaloDanaJamcevina || 0));
        break;
      case 'deadline_asc':
      default:
        result.sort((a, b) => (a.preostaloDanaJamcevina != null ? a.preostaloDanaJamcevina : 9999) - (b.preostaloDanaJamcevina != null ? b.preostaloDanaJamcevina : 9999));
        break;
    }

    return result;
  }

  // --- Rendering UI ---
  function renderStatusInfo() {
    if (!state.status) return;
    statusText.textContent = `${state.status.total_count} aktivnih dražbi • Ažurirano: ${state.status.last_updated_at}`;
  }

  function renderCountyCheckboxes() {
    if (!state.status || !state.status.counties) return;

    countyCheckboxes.innerHTML = '';
    const counties = state.status.counties;

    Object.keys(counties).forEach(countyName => {
      const count = counties[countyName];
      const isChecked = state.selectedCounties.has(countyName);

      const label = document.createElement('label');
      label.className = 'county-item';
      label.innerHTML = `
        <input type="checkbox" value="${countyName}" ${isChecked ? 'checked' : ''}>
        <span>${countyName}</span>
        <span class="county-badge-count">${count}</span>
      `;

      label.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          state.selectedCounties.add(countyName);
        } else {
          state.selectedCounties.delete(countyName);
        }
        updateCountyDropdownTrigger();
        renderActiveTags();
        renderListings();
      });

      countyCheckboxes.appendChild(label);
    });
  }

  function updateCountyDropdownTrigger() {
    const count = state.selectedCounties.size;
    if (count === 0) {
      countyDropdownLabel.textContent = 'Sve županije';
      countySelectedCount.style.display = 'none';
    } else if (count === 1) {
      countyDropdownLabel.textContent = Array.from(state.selectedCounties)[0];
      countySelectedCount.style.display = 'none';
    } else {
      countyDropdownLabel.textContent = 'Odabrane županije';
      countySelectedCount.textContent = count;
      countySelectedCount.style.display = 'inline-block';
    }
  }

  function renderActiveTags() {
    activeTagsList.innerHTML = '';
    let hasFilters = false;

    // Counties Tags
    state.selectedCounties.forEach(county => {
      hasFilters = true;
      const tag = document.createElement('span');
      tag.className = 'filter-tag';
      tag.innerHTML = `
        <span>${county}</span>
        <i class="fa-solid fa-xmark" data-action="remove-county" data-val="${county}"></i>
      `;
      activeTagsList.appendChild(tag);
    });

    // Type Tag
    if (state.selectedType !== 'all') {
      hasFilters = true;
      const tag = document.createElement('span');
      tag.className = 'filter-tag';
      tag.innerHTML = `
        <span>Vrsta: ${state.selectedType}</span>
        <i class="fa-solid fa-xmark" data-action="remove-type"></i>
      `;
      activeTagsList.appendChild(tag);
    }

    // Search Tag
    if (state.searchQuery) {
      hasFilters = true;
      const tag = document.createElement('span');
      tag.className = 'filter-tag';
      tag.innerHTML = `
        <span>Pretraga: "${state.searchQuery}"</span>
        <i class="fa-solid fa-xmark" data-action="remove-search"></i>
      `;
      activeTagsList.appendChild(tag);
    }

    activeTagsBar.style.display = hasFilters ? 'flex' : 'none';
  }

  function renderListings() {
    const items = getFilteredListings();

    resultsCounter.textContent = `(${items.length})`;

    if (state.currentTab === 'favorites') {
      resultsTitle.innerHTML = `Omiljene dražbe <span class="results-counter">(${items.length})</span>`;
    } else {
      resultsTitle.innerHTML = `Aktivne dražbe <span class="results-counter">(${items.length})</span>`;
    }

    // Empty states
    if (items.length === 0) {
      listingsGrid.innerHTML = '';
      if (state.currentTab === 'favorites' && state.favorites.size === 0) {
        emptyFavoritesState.style.display = 'block';
        emptyState.style.display = 'none';
      } else {
        emptyFavoritesState.style.display = 'none';
        emptyState.style.display = 'block';
      }
      return;
    }

    emptyState.style.display = 'none';
    emptyFavoritesState.style.display = 'none';

    // Render Cards
    listingsGrid.innerHTML = items.map(item => createListingCardHTML(item)).join('');

    // Attach card event listeners
    document.querySelectorAll('.listing-card').forEach(card => {
      const uuid = card.dataset.uuid;
      const item = state.listings.find(l => l.uuid === uuid);

      card.addEventListener('click', (e) => {
        if (e.target.closest('.fav-btn')) return;
        openModal(item);
      });

      const favBtn = card.querySelector('.fav-btn');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => toggleFavorite(uuid, e));
      }
    });
  }

  function createListingCardHTML(item) {
    const isFav = state.favorites.has(item.uuid);
    const days = item.preostaloDanaJamcevina;

    // Deadline badge and text
    let deadlineBadgeClass = 'badge-deadline-ok';
    let deadlineText = `Rok jamčevine: ${item.rokJamcevine || 'Otvoren'}`;
    let countdownText = '';

    if (days != null) {
      if (days === 0) {
        deadlineBadgeClass = 'badge-deadline-urgent';
        countdownText = `<span class="deadline-urgent"><i class="fa-solid fa-fire"></i> Hitno: Rok istječe DANAS!</span>`;
      } else if (days <= 3) {
        deadlineBadgeClass = 'badge-deadline-urgent';
        countdownText = `<span class="deadline-urgent"><i class="fa-solid fa-clock"></i> Još samo ${days} ${pluralDays(days)} za uplatu!</span>`;
      } else if (days <= 14) {
        deadlineBadgeClass = 'badge-deadline-warning';
        countdownText = `<span class="deadline-warning"><i class="fa-solid fa-hourglass-half"></i> Još ${days} dana za jamčevinu</span>`;
      } else {
        countdownText = `<span class="deadline-ok"><i class="fa-solid fa-circle-check"></i> Još ${days} dana za prijavu</span>`;
      }
    }

    // Icon for type
    let typeIcon = 'fa-building';
    if (item.glavnaVrsta === 'Kuća') typeIcon = 'fa-house';
    if (item.glavnaVrsta === 'Zemljište') typeIcon = 'fa-tree';
    if (item.glavnaVrsta === 'Poslovni prostor') typeIcon = 'fa-briefcase';
    if (item.glavnaVrsta === 'Garaža') typeIcon = 'fa-warehouse';

    const surfaceDisplay = item.glavnaPovrsina ? ` • ${item.glavnaPovrsina}` : '';
    const addressDisplay = item.glavnaAdresa || item.opis?.substring(0, 80) || 'Pogledaj detalje u oglasu';

    return `
      <div class="listing-card" data-uuid="${item.uuid}">
        <div class="card-top">
          <div class="card-badges">
            <span class="badge badge-type"><i class="fa-solid ${typeIcon}"></i> ${item.glavnaVrsta}</span>
            <span class="badge badge-county"><i class="fa-solid fa-location-dot"></i> ${item.zupanija}</span>
            <span class="badge ${deadlineBadgeClass}">${deadlineText}</span>
          </div>
          <button class="fav-btn ${isFav ? 'is-fav' : ''}" data-uuid="${item.uuid}" title="${isFav ? 'Ukloni iz omiljenih' : 'Dodaj u omiljeno'}">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
          </button>
        </div>

        <div class="card-body">
          <div class="card-location">
            <span>${item.glavniGrad}</span>
            <span class="text-muted" style="font-weight: 500; font-size: 13.5px;">${surfaceDisplay}</span>
          </div>
          <div class="card-address">${escapeHTML(addressDisplay)}</div>

          <div class="card-price-box">
            <div class="price-main">
              <span class="price-label">Početna cijena</span>
              <span class="price-value">${item.pocetnaCijenaFmt || `${item.pocetnaCijena} EUR`}</span>
            </div>
            <div class="price-sub-row">
              <span>Procijenjena vrijednost:</span>
              <strong>${item.utvrdenaVrijednost || 'Nije navedena'}</strong>
            </div>
            <div class="price-sub-row">
              <span>Jamčevina za uplatu:</span>
              <strong style="color: var(--primary);">${item.iznosJamcevine || 'Prema uvjetima'}</strong>
            </div>
          </div>

          <div class="card-legal">
            <div class="legal-item" title="Poslovni broj spisa">
              <i class="fa-solid fa-file-lines"></i>
              <span>Spis: <strong>${item.poslovniBroj || 'OVR'}</strong></span>
            </div>
            <div class="legal-item" title="${item.sud}">
              <i class="fa-solid fa-landmark"></i>
              <span>${item.sud || 'Nadležni sud'}</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <div class="deadline-countdown">${countdownText}</div>
          <span class="card-link-btn">Detalji <i class="fa-solid fa-arrow-right"></i></span>
        </div>
      </div>
    `;
  }

  // --- Modal View ---
  function openModal(item) {
    if (!item) return;
    activeModalListing = item;

    // Badges
    modalBadges.innerHTML = `
      <span class="badge badge-type">${item.glavnaVrsta}</span>
      <span class="badge badge-county">${item.zupanija}</span>
      <span class="badge badge-deadline-ok">Jamčevina do: ${item.rokJamcevine || 'Otvoreno'}</span>
    `;

    modalTitle.textContent = `${item.glavnaVrsta} • ${item.glavniGrad}`;
    modalSubtitle.textContent = item.glavnaAdresa ? `${item.glavnaAdresa}, ${item.zupanija}` : item.zupanija;

    modalCourtBadge.innerHTML = `<i class="fa-solid fa-landmark"></i> ${item.sud || 'Nadležni sud'} • Spis: <strong>${item.poslovniBroj}</strong>`;

    modalFinaLink.href = item.finaUrl;
    modalPismenaLink.href = item.pismenaUrl;

    updateModalFavBtn();

    // Body content
    let propsTableHTML = '';
    if (item.nekretnine && item.nekretnine.length > 0) {
      propsTableHTML = `
        <div class="modal-section">
          <div class="modal-section-title"><i class="fa-solid fa-table-list"></i> Predmeti i katastarske čestice (${item.nekretnine.length})</div>
          <div style="overflow-x: auto;">
            <table class="modal-table">
              <thead>
                <tr>
                  <th>Vrsta</th>
                  <th>Kat. općina</th>
                  <th>Površina</th>
                  <th>Naselje i adresa</th>
                  <th>Čestica</th>
                  <th>ZK uložak</th>
                  <th>Suvlasništvo</th>
                </tr>
              </thead>
              <tbody>
                ${item.nekretnine.map(p => `
                  <tr>
                    <td><strong>${p.vrsta || '-'}</strong></td>
                    <td>${p.katastarska_opcina || '-'}</td>
                    <td>${p.povrsina || '-'}</td>
                    <td>${[p.naselje, p.adresa].filter(Boolean).join(', ') || '-'}</td>
                    <td>${p.kat_cestica || '-'}</td>
                    <td>${p.zk_ulozak || '-'}</td>
                    <td>${p.suvlasnistvo || '1/1'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    let mapBoxHTML = '';
    if (item.lat && item.lng) {
      const gmapsUrl = `https://www.google.com/maps?q=${item.lat},${item.lng}`;
      mapBoxHTML = `
        <div class="map-link-box">
          <div class="map-link-box-left">
            <i class="fa-solid fa-location-crosshairs"></i>
            <div>
              <strong>Dostupne su točne geografske koordinate nekretnine!</strong>
              <div class="text-muted text-small">${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}</div>
            </div>
          </div>
          <a href="${gmapsUrl}" target="_blank" class="btn btn-outline btn-sm">
            <i class="fa-solid fa-map-location-dot"></i> Otvori na karti
          </a>
        </div>
      `;
    }

    let viewingHTML = '';
    if (item.razgledavanje) {
      viewingHTML = `
        <div class="modal-section">
          <div class="modal-section-title"><i class="fa-solid fa-eye"></i> Razgledavanje nekretnine</div>
          <div class="modal-text-block">${escapeHTML(item.razgledavanje)}</div>
        </div>
      `;
    }

    modalBody.innerHTML = `
      <!-- Stat Cards -->
      <div class="modal-stat-grid">
        <div class="modal-stat-card highlight">
          <div class="label">Početna cijena na dražbi</div>
          <div class="val">${item.pocetnaCijenaFmt || `${item.pocetnaCijena} EUR`}</div>
        </div>
        <div class="modal-stat-card">
          <div class="label">Utvrđena procijenjena vrijednost</div>
          <div class="val">${item.utvrdenaVrijednost || 'Nije navedena'}</div>
        </div>
        <div class="modal-stat-card">
          <div class="label">Iznos jamčevine za uplatu</div>
          <div class="val" style="color: var(--primary);">${item.iznosJamcevine || 'Prema uvjetima'}</div>
        </div>
      </div>

      <!-- Schedule Block -->
      <div class="modal-section">
        <div class="modal-section-title"><i class="fa-solid fa-calendar-days"></i> Ključni datumi i rokovi</div>
        <div class="modal-text-block" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div>
            <div class="text-muted text-small">Rok za uplatu jamčevine:</div>
            <strong>${item.rokJamcevine || 'Nije definiran'}</strong>
            <div class="text-small" style="color: var(--danger); font-weight: 600;">(Preostalo dana: ${item.preostaloDanaJamcevina != null ? item.preostaloDanaJamcevina : '-'})</div>
          </div>
          <div>
            <div class="text-muted text-small">Početak nadmetanja:</div>
            <strong>${item.pocetakDrazbe || 'U najavi'}</strong>
          </div>
          <div>
            <div class="text-muted text-small">Završetak nadmetanja:</div>
            <strong>${item.zavrsetakDrazbe || 'U najavi'}</strong>
          </div>
          <div>
            <div class="text-muted text-small">Dražbeni korak:</div>
            <strong>${item.drazbeniKorak || '-'}</strong>
          </div>
        </div>
      </div>

      ${mapBoxHTML}

      <!-- Description Block -->
      <div class="modal-section">
        <div class="modal-section-title"><i class="fa-solid fa-align-left"></i> Službeni opis iz sudskog zaključka</div>
        <div class="modal-text-block">${escapeHTML(item.opis || 'Opis nije priložen u sažetku. Detalje potražite u originalnom oglasu.')}</div>
      </div>

      ${viewingHTML}
      ${propsTableHTML}
    `;

    detailModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    detailModal.style.display = 'none';
    document.body.style.overflow = '';
    activeModalListing = null;
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Tab switching
    tabAll.addEventListener('click', () => switchTab('all'));
    tabFavorites.addEventListener('click', () => switchTab('favorites'));

    // Search input
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      clearSearchBtn.style.display = val ? 'block' : 'none';

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.searchQuery = val;
        renderActiveTags();
        renderListings();
      }, 200);
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      state.searchQuery = '';
      renderActiveTags();
      renderListings();
      searchInput.focus();
    });

    // Sort select
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderListings();
    });

    // Type Chips
    typeChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.type-chip');
      if (!chip) return;

      document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      state.selectedType = chip.dataset.type;
      renderActiveTags();
      renderListings();
    });

    // Multi-County Dropdown Toggle
    countyDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = countyDropdownMenu.style.display === 'block';
      countyDropdownMenu.style.display = isVisible ? 'none' : 'block';
    });

    // Close county menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!countyDropdownMenu.contains(e.target) && !countyDropdownBtn.contains(e.target)) {
        countyDropdownMenu.style.display = 'none';
      }
    });

    applyCountiesBtn.addEventListener('click', () => {
      countyDropdownMenu.style.display = 'none';
    });

    // County Presets
    document.getElementById('btnSelectAllCounties').addEventListener('click', () => {
      if (state.status && state.status.counties) {
        state.selectedCounties = new Set(Object.keys(state.status.counties));
        renderCountyCheckboxes();
        updateCountyDropdownTrigger();
        renderActiveTags();
        renderListings();
      }
    });

    document.getElementById('btnClearCounties').addEventListener('click', () => {
      state.selectedCounties.clear();
      renderCountyCheckboxes();
      updateCountyDropdownTrigger();
      renderActiveTags();
      renderListings();
    });

    document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        const presetCounties = COUNTY_PRESETS[presetKey] || [];
        state.selectedCounties = new Set(presetCounties);
        renderCountyCheckboxes();
        updateCountyDropdownTrigger();
        renderActiveTags();
        renderListings();
      });
    });

    // Active Tags Removal Delegation
    activeTagsBar.addEventListener('click', (e) => {
      const icon = e.target.closest('i');
      if (!icon) return;

      const action = icon.dataset.action;
      if (action === 'remove-county') {
        const val = icon.dataset.val;
        state.selectedCounties.delete(val);
        renderCountyCheckboxes();
        updateCountyDropdownTrigger();
      } else if (action === 'remove-type') {
        state.selectedType = 'all';
        document.querySelectorAll('.type-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.type === 'all');
        });
      } else if (action === 'remove-search') {
        state.searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
      }

      renderActiveTags();
      renderListings();
    });

    resetAllFiltersBtn.addEventListener('click', resetAllFilters);
    resetFromEmptyBtn.addEventListener('click', resetAllFilters);
    browseFromFavBtn.addEventListener('click', () => switchTab('all'));

    // Refresh Live Data Button
    refreshBtn.addEventListener('click', syncListings);

    // Modal Events
    modalCloseBtn.addEventListener('click', closeModal);
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) closeModal();
    });

    modalFavBtn.addEventListener('click', () => {
      if (activeModalListing) {
        toggleFavorite(activeModalListing.uuid);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && detailModal.style.display === 'flex') {
        closeModal();
      }
    });
  }

  function switchTab(tab) {
    state.currentTab = tab;
    tabAll.classList.toggle('active', tab === 'all');
    tabFavorites.classList.toggle('active', tab === 'favorites');
    renderListings();
  }

  function resetAllFilters() {
    state.selectedCounties.clear();
    state.selectedType = 'all';
    state.searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';

    document.querySelectorAll('.type-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.type === 'all');
    });

    renderCountyCheckboxes();
    updateCountyDropdownTrigger();
    renderActiveTags();
    renderListings();
  }

  function showLoading(show) {
    loadingState.style.display = show ? 'block' : 'none';
    if (show) {
      listingsGrid.innerHTML = '';
      emptyState.style.display = 'none';
      emptyFavoritesState.style.display = 'none';
    }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  function pluralDays(n) {
    if (n === 1) return 'dan';
    if (n >= 2 && n <= 4) return 'dana';
    return 'dana';
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
