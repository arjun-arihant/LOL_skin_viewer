/* ─────────────────────────────────────────────────────────────────────────
   LOL Skin Viewer — Renderer
   Handles: data loading, champion sidebar, skin grid, search, modal
───────────────────────────────────────────────────────────────────────── */

// ─── STATE ────────────────────────────────────────────────────────────────────
let allSkins = [];
let filteredSkins = [];
let activeChamp = null;   // null = "All"
let skinQuery = '';
let summoner = null;

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const errorOverlay = document.getElementById('error-overlay');
const errorTitle = document.getElementById('error-title');
const errorMsg = document.getElementById('error-msg');
const btnRetry = document.getElementById('btn-retry');
const champList = document.getElementById('champ-list');
const champCount = document.getElementById('champ-count');
const champSearch = document.getElementById('champ-search');
const skinGrid = document.getElementById('skin-grid');
const skinCountBadge = document.getElementById('skin-count-badge');
const filterLabel = document.getElementById('filter-label');
const skinSearch = document.getElementById('skin-search');
const emptyState = document.getElementById('empty-state');
const summHeader = document.getElementById('summoner-header');
const btnRefresh = document.getElementById('btn-refresh');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalSplash = document.getElementById('modal-splash');
const modalChamp = document.getElementById('modal-champ');
const modalName = document.getElementById('modal-name');
const modalId = document.getElementById('modal-id');

// ─── TITLEBAR CONTROLS ────────────────────────────────────────────────────────
document.getElementById('btn-minimize').addEventListener('click', () => window.lolAPI.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.lolAPI.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.lolAPI.close());

// ─── SKIN RARITY DETECTION ────────────────────────────────────────────────────
function getSkinRarity(skin) {
    if (skin.isBase) return { label: 'Classic', cls: 'tag-base' };
    const n = skin.name.toLowerCase();
    if (/prestige/.test(n)) return { label: 'Prestige', cls: 'tag-prestige' };
    if (/ultimate/.test(n)) return { label: 'Ultimate', cls: 'tag-ultimate' };
    if (/mythic/.test(n)) return { label: 'Mythic', cls: 'tag-mythic' };
    if (/legendary|lancer/.test(n)) return { label: 'Legendary', cls: 'tag-legendary' };
    return { label: 'Epic', cls: 'tag-epic' };
}

// ─── RENDER CHAMPION SIDEBAR ──────────────────────────────────────────────────
function buildChampionSidebar(skins) {
    const champMap = {};
    for (const s of skins) {
        if (!champMap[s.championKey]) {
            champMap[s.championKey] = {
                name: s.championName,
                key: s.championKey,
                count: 0,
                version: s.version,
            };
        }
        champMap[s.championKey].count++;
    }

    const champs = Object.values(champMap).sort((a, b) => a.name.localeCompare(b.name));
    champCount.textContent = champs.length;

    champList.innerHTML = '';

    // "All" row
    const allRow = document.createElement('div');
    allRow.className = 'champ-item champ-item-all' + (activeChamp === null ? ' active' : '');
    allRow.innerHTML = `<span>All Champions</span>`;
    allRow.addEventListener('click', () => setChampFilter(null));
    champList.appendChild(allRow);

    // Per-champion rows
    for (const champ of champs) {
        const row = document.createElement('div');
        row.className = 'champ-item' + (activeChamp === champ.key ? ' active' : '');
        row.dataset.key = champ.key;

        const portraitUrl = `https://ddragon.leagueoflegends.com/cdn/${skins[0].version}/img/champion/${champ.key}.png`;

        row.innerHTML = `
      <img class="champ-portrait" src="${portraitUrl}" alt="${champ.name}"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>'"/>
      <div class="champ-info">
        <div class="champ-name">${champ.name}</div>
        <div class="champ-skin-num">${champ.count} skin${champ.count !== 1 ? 's' : ''}</div>
      </div>
    `;
        row.addEventListener('click', () => setChampFilter(champ.key));
        champList.appendChild(row);
    }
}

// ─── CHAMPION FILTER ──────────────────────────────────────────────────────────
function setChampFilter(champKey) {
    activeChamp = champKey;

    // Update sidebar active states
    document.querySelectorAll('.champ-item').forEach((el) => el.classList.remove('active'));
    if (champKey === null) {
        document.querySelector('.champ-item-all')?.classList.add('active');
        filterLabel.textContent = 'All Skins';
    } else {
        const champ = allSkins.find((s) => s.championKey === champKey);
        if (champ) filterLabel.textContent = champ.championName;
        document.querySelector(`.champ-item[data-key="${champKey}"]`)?.classList.add('active');
    }

    applyFilters();
}

// ─── FILTER & RENDER ─────────────────────────────────────────────────────────
function applyFilters() {
    filteredSkins = allSkins.filter((s) => {
        const matchChamp = activeChamp === null || s.championKey === activeChamp;
        const q = skinQuery.toLowerCase();
        const matchSearch =
            !q ||
            s.name.toLowerCase().includes(q) ||
            s.championName.toLowerCase().includes(q);
        return matchChamp && matchSearch;
    });

    renderGrid(filteredSkins);
}

function renderGrid(skins) {
    skinGrid.innerHTML = '';
    skinCountBadge.textContent = skins.length;

    if (skins.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    for (const skin of skins) {
        skinGrid.appendChild(createSkinCard(skin));
    }
}

// ─── SKIN CARD ────────────────────────────────────────────────────────────────
function createSkinCard(skin) {
    const card = document.createElement('div');
    card.className = 'skin-card';

    const rarity = getSkinRarity(skin);

    // Placeholder img that loads asynchronously
    const img = document.createElement('img');
    img.className = 'skin-card-img loading';
    img.alt = skin.name;
    img.loading = 'lazy';

    // Use tile URL for grid (smaller), splash for modal
    img.src = skin.tileUrl;
    img.onload = () => img.classList.remove('loading');
    img.onerror = () => {
        img.classList.remove('loading');
        img.src = skin.splashUrl; // fallback to full splash
        img.onerror = () => (img.style.display = 'none');
    };

    card.innerHTML = `
    <div class="skin-card-tag ${rarity.cls}">${rarity.label}</div>
    <div class="skin-card-overlay">
      <div class="skin-card-champ">${skin.championName}</div>
      <div class="skin-card-name">${skin.name}</div>
    </div>
  `;
    card.insertBefore(img, card.firstChild);

    card.addEventListener('click', () => openModal(skin));
    return card;
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(skin) {
    modalChamp.textContent = skin.championName;
    modalName.textContent = skin.name;
    modalId.textContent = `Skin ID: ${skin.id}  ·  Skin #${skin.skinNum}`;
    modalSplash.src = skin.splashUrl;
    modalBackdrop.style.display = 'flex';
}

function closeModal() {
    modalBackdrop.style.display = 'none';
    modalSplash.src = '';
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ─── SUMMONER HEADER ──────────────────────────────────────────────────────────
function renderSummonerHeader(sum) {
    summHeader.innerHTML = `
    <div class="summoner-badge">
      <img class="summoner-avatar" src="${sum.profileIconUrl}" alt="icon"
           onerror="this.style.display='none'"/>
      <span class="summoner-name">${sum.displayName}</span>
      <span class="summoner-level">Lv. ${sum.summonerLevel}</span>
    </div>
  `;
}

// ─── LOADING / ERROR ──────────────────────────────────────────────────────────
function showLoading(text = 'Connecting to League Client…') {
    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.style.display = 'flex';
    errorOverlay.style.display = 'none';
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    setTimeout(() => (loadingOverlay.style.display = 'none'), 420);
}

function showError(title, msg) {
    hideLoading();
    errorTitle.textContent = title;
    errorMsg.textContent = msg;
    errorOverlay.style.display = 'flex';
}

function hideError() {
    errorOverlay.style.display = 'none';
}

// ─── MAIN LOAD ────────────────────────────────────────────────────────────────
async function loadSkins(isRefresh = false) {
    showLoading(isRefresh ? 'Refreshing skin data…' : 'Connecting to League Client…');
    hideError();

    try {
        const res = isRefresh
            ? await window.lolAPI.refreshSkins()
            : await window.lolAPI.getSkins();

        if (!res.success) {
            const isNotRunning = res.error === 'LEAGUE_NOT_RUNNING';
            showError(
                isNotRunning ? 'League Client Not Found' : 'Failed to Load Skins',
                isNotRunning
                    ? 'Please open the League of Legends client and log in, then click Try Again.'
                    : `Error: ${res.error}\n\nMake sure the League client is running and you are logged in.`
            );
            return;
        }

        const data = res.data;
        summoner = data.summoner;
        allSkins = data.skins.map(s => ({ ...s, version: data.version }));

        renderSummonerHeader(summoner);
        buildChampionSidebar(allSkins);
        applyFilters();
        hideLoading();

    } catch (err) {
        showError('Unexpected Error', err.message || String(err));
    }
}

// ─── CHAMPION SIDEBAR SEARCH ──────────────────────────────────────────────────
champSearch.addEventListener('input', () => {
    const q = champSearch.value.toLowerCase();
    document.querySelectorAll('.champ-item:not(.champ-item-all)').forEach((el) => {
        const name = el.querySelector('.champ-name')?.textContent.toLowerCase() || '';
        el.style.display = name.includes(q) ? '' : 'none';
    });
});

// ─── SKIN SEARCH ─────────────────────────────────────────────────────────────
skinSearch.addEventListener('input', () => {
    skinQuery = skinSearch.value;
    applyFilters();
});

// ─── REFRESH ─────────────────────────────────────────────────────────────────
btnRefresh.addEventListener('click', () => {
    btnRefresh.classList.add('spinning');
    loadSkins(true).finally(() => btnRefresh.classList.remove('spinning'));
});

btnRetry.addEventListener('click', () => {
    hideError();
    loadSkins(false);
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadSkins(false);
