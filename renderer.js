/* ─────────────────────────────────────────────────────────────────────────
   LOL Skin Viewer — Renderer
   Panel-based layout with CDragon borders, tier gems, and grouped rendering
───────────────────────────────────────────────────────────────────────── */

// ─── STATE ────────────────────────────────────────────────────────────────────
let allSkins = [];
let filteredSkins = [];
let searchQuery = '';
let showUnowned = false;
let groupBy = 'champion';   // champion | tier | all
let sortBy = 'mastery';       // alpha | mastery | most-owned
let summoner = null;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RARITY_ORDER = { transcendent: 0, exalted: 1, ultimate: 2, mythic: 3, legendary: 4, epic: 5, standard: 6 };

const RARITY_ICON = {
    transcendent: 'assets/tier-icons/transcendent.png',
    exalted: 'assets/tier-icons/exalted.png',
    ultimate: 'assets/tier-icons/ultimate.png',
    mythic: 'assets/tier-icons/mythic.png',
    legendary: 'assets/tier-icons/legendary.png',
    epic: 'assets/tier-icons/epic.png',
    standard: 'assets/tier-icons/standard.png',
};

const BORDER_MAP = {
    transcendent: 'assets/borders/borders_transcendent.png',
    exalted: 'assets/borders/borders_exalted.png',
    ultimate: 'assets/borders/borders_ultimate.png',
    mythic: 'assets/borders/borders_mythic.png',
    legendary: 'assets/borders/borders_legendary.png',
    epic: 'assets/borders/borders_epic.png',
    standard: 'assets/borders/borders_normal.png',
};

const LOCK_ICON = 'assets/tier-icons/icon-lock.png';

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const errorOverlay = document.getElementById('error-overlay');
const errorTitle = document.getElementById('error-title');
const errorMsg = document.getElementById('error-msg');
const btnRetry = document.getElementById('btn-retry');
const skinGrid = document.getElementById('skin-grid');
const filterLabel = document.getElementById('filter-label');
const emptyState = document.getElementById('empty-state');
const summHeader = document.getElementById('summoner-header');
const btnRefresh = document.getElementById('btn-refresh');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalSplash = document.getElementById('modal-splash');
const modalChamp = document.getElementById('modal-champ');
const modalName = document.getElementById('modal-name');
const modalId = document.getElementById('modal-id');

// ─── AUDIO CONTROLLER ─────────────────────────────────────────────────────────
const AudioController = {
    sounds: {
        hover: new Audio('assets/sounds/sfx-uikit-grid-hover.ogg'),
        click: new Audio('assets/sounds/sfx-uikit-grid-click.ogg'),
        release: new Audio('assets/sounds/sfx-uikit-grid-release.ogg'),
        search: new Audio('assets/sounds/sfx-uikit-generic-click-small.ogg'),
        toggle: new Audio('assets/sounds/sfx-uikit-toggle-click.ogg'),
        dropdownOpen: new Audio('assets/sounds/sfx-uikit-dropdown-open.ogg'),
        dropdownSelect: new Audio('assets/sounds/sfx-uikit-button-pip-click.ogg'),
    },
    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName].currentTime = 0;
            this.sounds[soundName].play().catch(() => { });
        }
    }
};

// Set specific volumes
AudioController.sounds.dropdownOpen.volume = 0.1;

// ─── TITLEBAR CONTROLS ────────────────────────────────────────────────────────
document.getElementById('btn-minimize').addEventListener('click', () => window.lolAPI.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.lolAPI.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.lolAPI.close());

// ─── STATS PANEL ──────────────────────────────────────────────────────────────
function countUp(el, endVal) {
    const duration = 1000; // Speed of the animation (ms). Adjust this value to make it faster/slower
    const startTime = performance.now();
    const isDoubleFormat = endVal >= 10;

    const step = (timestamp) => {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        let current = Math.floor(progress * endVal);

        let text = current.toString();
        // If final number is double digit, single digits should be padded like "05"
        if (isDoubleFormat && current < 10) text = '0' + text;
        // If final number is triple digit, handle padding
        if (endVal >= 100 && current < 100 && current >= 10) text = '0' + text;
        if (endVal >= 100 && current < 10) text = '00' + text;

        el.textContent = text;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = endVal;
    };
    requestAnimationFrame(step);
}

function updateStatsPanel(stats) {
    const totalEl = document.getElementById('stats-total');
    countUp(totalEl, stats.total);

    for (const [rarity, count] of Object.entries(stats.byRarity)) {
        const el = document.getElementById(`gem-${rarity}`);
        if (el) el.textContent = count;
    }
    document.getElementById('stat-legacy').textContent = stats.legacy;
    document.getElementById('stat-chromas').textContent = stats.ownedChromas;
}

// ─── FILTER & RENDER ─────────────────────────────────────────────────────────
function applyFilters() {
    const q = searchQuery.toLowerCase();
    filteredSkins = allSkins.filter(s => {
        if (!showUnowned && !s.owned) return false;
        if (q && !s.name.toLowerCase().includes(q) && !s.championName.toLowerCase().includes(q)) return false;
        return true;
    });
    renderGrid(filteredSkins);
}

function getSortedGroups(skins) {
    if (groupBy === 'all') {
        return [{ key: 'all', label: 'ALL SKINS', skins }];
    }

    // Pre-calculate the true absolute totals for every group bypassing the filters
    const trueCounts = {};
    for (const s of allSkins) {
        const key = groupBy === 'champion' ? s.championKey : s.rarity;
        if (!trueCounts[key]) trueCounts[key] = { owned: 0, total: 0 };
        trueCounts[key].total++;
        if (s.owned) trueCounts[key].owned++;
    }

    const groups = {};
    for (const s of skins) {
        let key, label;
        if (groupBy === 'champion') {
            key = s.championKey;
            label = s.championName;
        } else if (groupBy === 'tier') {
            key = s.rarity;
            label = s.rarity.charAt(0).toUpperCase() + s.rarity.slice(1);
        }

        if (!groups[key]) {
            groups[key] = {
                key, label, skins: [],
                owned: trueCounts[key].owned,
                total: trueCounts[key].total,
                mastery: 0
            };
        }
        groups[key].skins.push(s);
        if (s.mastery) groups[key].mastery = Math.max(groups[key].mastery, s.mastery.points || 0);
    }

    let sorted = Object.values(groups);

    if (groupBy === 'tier') {
        sorted.sort((a, b) => (RARITY_ORDER[a.key] ?? 99) - (RARITY_ORDER[b.key] ?? 99));
    } else if (sortBy === 'mastery') {
        sorted.sort((a, b) => b.mastery - a.mastery);
    } else if (sortBy === 'most-owned') {
        sorted.sort((a, b) => b.owned - a.owned);
    } else {
        sorted.sort((a, b) => a.label.localeCompare(b.label));
    }

    // Sort skins within each group: owned first, then by skinNum
    for (const g of sorted) {
        g.skins.sort((a, b) => {
            if (a.owned !== b.owned) return a.owned ? -1 : 1;
            return a.skinNum - b.skinNum;
        });
    }

    return sorted;
}

function renderGrid(skins) {
    skinGrid.innerHTML = '';

    if (skins.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    const groups = getSortedGroups(skins);

    for (const group of groups) {
        // Group header
        if (groups.length > 1 || groupBy !== 'all') {
            const header = document.createElement('div');
            header.className = 'group-header';
            header.innerHTML = `
                <span class="group-header-name">${group.label.toUpperCase()}</span>
                <span class="group-header-count">${group.owned}/${group.total}</span>
                <span class="group-header-line"></span>
            `;
            skinGrid.appendChild(header);
        }

        // Cards
        for (const skin of group.skins) {
            skinGrid.appendChild(createSkinCard(skin));
        }
    }
}

// ─── SKIN CARD ────────────────────────────────────────────────────────────────
function createSkinCard(skin) {
    const card = document.createElement('div');
    card.className = `skin-card${!skin.owned ? ' unowned' : ''}`;
    card.tabIndex = 0;

    // Splash image
    const img = document.createElement('img');
    img.className = 'skin-card-img loading';
    img.alt = skin.name;
    img.loading = 'lazy';
    img.src = skin.tileUrl;
    img.onload = () => img.classList.remove('loading');
    img.onerror = () => {
        img.classList.remove('loading');
        img.src = skin.splashUrl;
        img.onerror = () => (img.style.display = 'none');
    };
    card.appendChild(img);

    // CDragon border overlay
    const borderSrc = BORDER_MAP[skin.rarity] || BORDER_MAP.standard;
    const borderImg = document.createElement('img');
    borderImg.className = 'skin-card-border';
    borderImg.src = borderSrc;
    borderImg.alt = '';
    borderImg.draggable = false;
    card.appendChild(borderImg);

    // Name overlay
    const overlay = document.createElement('div');
    overlay.className = 'skin-card-overlay';
    overlay.innerHTML = `<div class="skin-card-name">${skin.name}</div>`;
    card.appendChild(overlay);

    if (skin.owned) {
        // Rarity gem (for owned non-base skins)
        if (!skin.isBase) {
            const iconPath = RARITY_ICON[skin.rarity] || RARITY_ICON.epic;
            const gem = document.createElement('div');
            gem.className = `skin-card-gem ${skin.rarity}`;
            const gemImg = document.createElement('img');
            gemImg.src = iconPath;
            gemImg.alt = skin.rarity;
            gemImg.draggable = false;
            gem.appendChild(gemImg);
            card.appendChild(gem);
        }

        // Chroma badge
        if (skin.chromas && skin.chromas.owned > 0) {
            const badge = document.createElement('div');
            badge.className = 'chroma-badge';
            badge.innerHTML = `
                <img src="assets/tier-icons/chroma.png" alt="Chromas" draggable="false">
                <span class="chroma-count">${skin.chromas.owned}</span>
            `;
            badge.title = `${skin.chromas.owned} chroma${skin.chromas.owned > 1 ? 's' : ''}`;
            card.appendChild(badge);
        }
    } else {
        // Lock icon for unowned
        const lock = document.createElement('div');
        lock.className = 'lock-icon';
        lock.innerHTML = `<img src="${LOCK_ICON}" alt="Unowned" draggable="false">`;
        card.appendChild(lock);
    }

    card.addEventListener('mouseenter', () => AudioController.play('hover'));
    card.addEventListener('click', () => {
        AudioController.play('click');
        openModal(skin);
    });
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
    AudioController.play('release');
    modalBackdrop.style.display = 'none';
    modalSplash.src = '';
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalBackdrop.style.display === 'flex') closeModal(); });

// ─── SUMMONER HEADER ──────────────────────────────────────────────────────────
function renderSummonerHeader(sum, status = 'connected') {
    let statusText = 'Connected';
    let statusColor = '#00eb9c';

    if (status === 'connecting') {
        statusText = 'Connecting';
        statusColor = '#e8ba5d';
    } else if (status === 'disconnected') {
        statusText = 'Disconnected';
        statusColor = '#e84057';
    }

    summHeader.innerHTML = `
    <div class="summoner-profile">
      <div class="summoner-avatar-wrapper">
        <img class="summoner-avatar" src="${sum.profileIconUrl}" alt="icon" onerror="this.style.display='none'"/>
        <div class="summoner-level-wrapper">
          <div class="summoner-level"><span>${sum.summonerLevel}</span></div>
        </div>
      </div>
      <div class="summoner-details">
        <div class="summoner-name">${sum.displayName}</div>
        <div class="summoner-status">
          <span class="status-dot" style="background: ${statusColor}"></span>
          <span class="status-text" style="color: ${statusColor}">${statusText}</span>
        </div>
      </div>
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

function hideError() { errorOverlay.style.display = 'none'; }

// ─── MAIN LOAD ────────────────────────────────────────────────────────────────
async function loadSkins(isRefresh = false) {
    hideError();

    // 1. Attempt instantaneous cache load
    if (!isRefresh && allSkins.length === 0) {
        const cached = await window.lolAPI.getCachedSkins();
        if (cached && cached.success) {
            const data = cached.data;
            summoner = data.summoner;
            allSkins = data.skins;
            renderSummonerHeader(summoner, 'connecting'); // Render as connecting
            if (data.stats) updateStatsPanel(data.stats);
            applyFilters();
            hideLoading(); // MUST CALL THIS to clear the default loading overlay
        }
    }

    // 2. Only show loading block if we have completely empty cache
    if (!isRefresh && allSkins.length === 0) {
        showLoading('Connecting to League Client…');
    }

    // 3. Perform live sync
    try {
        const res = isRefresh ? await window.lolAPI.refreshSkins() : await window.lolAPI.getSkins();

        if (!res.success) {
            // If we have cached skins, silently fail the background refresh
            if (allSkins.length > 0) {
                renderSummonerHeader(summoner, 'disconnected');
                return;
            }

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

        renderSummonerHeader(summoner, 'connected'); // Connected
        if (data.stats) updateStatsPanel(data.stats);
        applyFilters();
        hideLoading();

    } catch (err) {
        if (allSkins.length === 0) {
            showError('Unexpected Error', err.message || String(err));
        }
    }
}

// ─── PANEL SEARCH ─────────────────────────────────────────────────────────────
const panelSearch = document.getElementById('panel-search');
panelSearch.addEventListener('focus', () => AudioController.play('search'));
panelSearch.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFilters();
});

// ─── SHOW UNOWNED TOGGLE ──────────────────────────────────────────────────────
document.getElementById('toggle-unowned').addEventListener('change', (e) => {
    AudioController.play('toggle');
    showUnowned = e.target.checked;
    applyFilters();
});

// ─── DROPDOWN LOGIC ───────────────────────────────────────────────────────────
function setupDropdown(wrapId, menuId, labelId, onChange) {
    const wrap = document.getElementById(wrapId);
    const menu = document.getElementById(menuId);
    const label = document.getElementById(labelId);
    const btn = wrap.querySelector('.dropdown-btn');

    btn.addEventListener('click', () => {
        const isOpen = menu.classList.contains('open');
        // Close all dropdowns first
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
        if (!isOpen) {
            AudioController.play('dropdownOpen');
            menu.classList.add('open');
        }
    });

    menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            AudioController.play('dropdownSelect');
            menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            label.textContent = item.textContent.replace('✓', '').trim();
            menu.classList.remove('open');
            onChange(item.dataset.value);
        });
    });
}

setupDropdown('group-dropdown', 'group-menu', 'group-label', (val) => {
    groupBy = val;
    applyFilters();
});

setupDropdown('sort-dropdown', 'sort-menu', 'sort-label', (val) => {
    sortBy = val;
    applyFilters();
});

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-wrap')) {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
    }
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
