/* ─────────────────────────────────────────────────────────────────────────
   RiftVault — Renderer
   Panel-based layout with CDragon borders, tier gems, and grouped rendering
───────────────────────────────────────────────────────────────────────── */

// ─── STATE ────────────────────────────────────────────────────────────────────
let allSkins = [];
let filteredSkins = [];
let searchQuery = '';
let showUnowned = false;
let showBase = true;
let groupBy = 'champion';   // all | champion | set | tier
let sortBy = 'mastery';       // alpha | mastery | most-owned | most-complete
let summoner = null;
let isAnimatingStats = false;
let LCU_PORT = null;
let rpPrices = {};
let champSelectActive = false;
let champSelectChampId = 0;
let champSelectSkinId = 0;
let skinLineNames = {}; // id → display name, populated from main process
let filterLegacyOnly = false;
let filterPrestigeOnly = false;
let wishlist = new Set();
let filterWishlistOnly = false;
let achievements = [];         // loaded from achievements.json + curator-picks.json
let earnedAchievements = {};   // { id: timestamp } persisted in localStorage
let wishlistHistory = new Set(); // ever-added skin IDs (never shrinks)
let shareShowSummoner = true;

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
const emptyState = document.getElementById('empty-state');
const summHeader = document.getElementById('summoner-header');
const btnRefresh = document.getElementById('btn-refresh');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalSplash = document.getElementById('modal-splash');
const modalChamp = document.getElementById('modal-champ');
const modalName = document.getElementById('modal-name');
const modalId = document.getElementById('modal-id');
const wikiLink = document.getElementById('wiki-link');
const modelLink = document.getElementById('model-link');
const spotlightLink = document.getElementById('spotlight-link');

// ─── TAB MANAGER ──────────────────────────────────────────────────────────────
const TabManager = {
    tabs: [{ id: 'home', type: 'home', title: 'Collection', closable: false }],
    activeTabId: 'home',
    nextId: 1,
    maxTabs: 8,

    createTab(url, title, icon = '🌐') {
        if (this.tabs.length >= this.maxTabs) {
            // Close oldest non-home tab
            const oldest = this.tabs.find(t => t.id !== 'home' && t.id !== 'wishlist' && t.id !== 'achievements');
            if (oldest) this.closeTab(oldest.id);
        }

        const id = `tab-${this.nextId++}`;
        const tab = { id, type: 'webview', title, url, icon, closable: true };
        this.tabs.push(tab);

        // Create tab button
        const tabBtn = document.createElement('button');
        tabBtn.className = 'tab-item';
        tabBtn.dataset.tab = id;
        tabBtn.innerHTML = `
            <span class="tab-icon">${icon}</span>
            <span class="tab-label">${title}</span>
            <span class="tab-close" data-close="${id}">&times;</span>
        `;
        tabBtn.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) return;
            this.switchTab(id);
        });
        tabBtn.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(id);
        });
        document.getElementById('tab-bar').appendChild(tabBtn);

        // Create webview pane
        const pane = document.createElement('div');
        pane.className = 'tab-pane-webview';
        pane.id = `pane-${id}`;
        pane.innerHTML = `<webview src="${url}" style="width:100%;height:100%;" allowpopups></webview>`;
        document.getElementById('webview-container').appendChild(pane);

        this.switchTab(id);
        return id;
    },

    openWishlistTab() {
        // Toggle: if wishlist tab already exists and is active, switch back to home
        const existing = this.tabs.find(t => t.id === 'wishlist');
        if (existing) {
            if (this.activeTabId === 'wishlist') {
                this.switchTab('home');
            } else {
                this.switchTab('wishlist');
            }
            return;
        }

        // Create wishlist tab
        const tab = { id: 'wishlist', type: 'wishlist', title: '♥ Wishlist', icon: '♥', closable: true };
        this.tabs.push(tab);

        const tabBtn = document.createElement('button');
        tabBtn.className = 'tab-item';
        tabBtn.dataset.tab = 'wishlist';
        tabBtn.innerHTML = `
            <span class="tab-icon" style="color:#e84057">♥</span>
            <span class="tab-label">Wishlist</span>
            <span class="tab-close" data-close="wishlist">&times;</span>
        `;
        tabBtn.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) return;
            this.switchTab('wishlist');
        });
        tabBtn.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab('wishlist');
        });
        document.getElementById('tab-bar').appendChild(tabBtn);

        this.switchTab('wishlist');
    },

    switchTab(tabId) {
        this.activeTabId = tabId;

        // Update tab buttons
        document.querySelectorAll('.tab-item').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });

        // Update wishlist titlebar button
        const wishBtn = document.getElementById('btn-wishlist-tab');
        if (wishBtn) wishBtn.classList.toggle('active', tabId === 'wishlist');

        const achBtn = document.getElementById('btn-achievements-tab');
        if (achBtn) {
            achBtn.classList.toggle('active', tabId === 'achievements');
            const dot = achBtn.querySelector('.new-dot');
            if (dot && tabId === 'achievements') dot.remove();
        }

        // Hide all panes
        document.getElementById('pane-home').classList.remove('active');
        document.getElementById('pane-wishlist').classList.remove('active');
        document.getElementById('pane-achievements').classList.remove('active');
        document.querySelectorAll('.tab-pane-webview').forEach(p => p.classList.remove('active'));

        if (tabId === 'home') {
            document.getElementById('pane-home').classList.add('active');
            filterWishlistOnly = false;
        } else if (tabId === 'wishlist') {
            document.getElementById('pane-wishlist').classList.add('active');
            this.renderWishlistGrid();
        } else if (tabId === 'achievements') {
            document.getElementById('pane-achievements').classList.add('active');
            renderAchievementsGrid();
        } else {
            // Webview tab
            const pane = document.getElementById(`pane-${tabId}`);
            if (pane) pane.classList.add('active');
        }
    },

    renderWishlistGrid() {
        const grid = document.getElementById('wishlist-grid');
        const empty = document.getElementById('wishlist-empty');
        const label = document.getElementById('wishlist-count-label');
        grid.innerHTML = '';

        const wishlisted = allSkins.filter(s => wishlist.has(s.id));
        label.textContent = `${wishlisted.length} skin${wishlisted.length !== 1 ? 's' : ''} wishlisted`;

        if (wishlisted.length === 0) {
            empty.style.display = 'flex';
            return;
        }
        empty.style.display = 'none';

        // Sort: by champion name then skin num
        wishlisted.sort((a, b) => a.championName.localeCompare(b.championName) || a.skinNum - b.skinNum);

        for (const skin of wishlisted) {
            grid.appendChild(createSkinCard(skin));
        }
    },

    closeTab(tabId) {
        if (tabId === 'home') return;

        // Remove from tabs array
        this.tabs = this.tabs.filter(t => t.id !== tabId);

        // Remove tab button
        const tabBtn = document.querySelector(`.tab-item[data-tab="${tabId}"]`);
        if (tabBtn) tabBtn.remove();

        // Remove pane (only webview panes are dynamic; wishlist/achievements panes are permanent)
        if (tabId !== 'wishlist' && tabId !== 'achievements') {
            const pane = document.getElementById(`pane-${tabId}`);
            if (pane) pane.remove();
        }

        // If closing the active tab, switch to home
        if (this.activeTabId === tabId) {
            this.switchTab('home');
        }

        // Reset wishlist / achievements button state
        if (tabId === 'wishlist') {
            const wishBtn = document.getElementById('btn-wishlist-tab');
            if (wishBtn) wishBtn.classList.remove('active');
        }
        if (tabId === 'achievements') {
            const achBtn = document.getElementById('btn-achievements-tab');
            if (achBtn) achBtn.classList.remove('active');
        }
    },

    openAchievementsTab() {
        const existing = this.tabs.find(t => t.id === 'achievements');
        if (existing) {
            if (this.activeTabId === 'achievements') {
                this.switchTab('home');
            } else {
                this.switchTab('achievements');
            }
            return;
        }

        const tab = { id: 'achievements', type: 'achievements', title: '🏆 Achievements', icon: '🏆', closable: true };
        this.tabs.push(tab);

        const tabBtn = document.createElement('button');
        tabBtn.className = 'tab-item';
        tabBtn.dataset.tab = 'achievements';
        tabBtn.innerHTML = `
            <span class="tab-icon">🏆</span>
            <span class="tab-label">Achievements</span>
            <span class="tab-close" data-close="achievements">&times;</span>
        `;
        tabBtn.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) return;
            this.switchTab('achievements');
        });
        tabBtn.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab('achievements');
        });
        document.getElementById('tab-bar').appendChild(tabBtn);

        this.switchTab('achievements');
    }
};

// ─── EXTERNAL LINKS ───────────────────────────────────────────────────────────
document.getElementById('github-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.riftVaultAPI.openExternal('https://github.com/arjun-arihant/RiftVault');
});

// ─── HOME TAB CLICK ───────────────────────────────────────────────────────────
document.querySelector('.tab-item[data-tab="home"]').addEventListener('click', () => {
    TabManager.switchTab('home');
});

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

AudioController.sounds.hover.volume = 0.5;
AudioController.sounds.click.volume = 0.1;
AudioController.sounds.release.volume = 0.1;
AudioController.sounds.search.volume = 0.1;
AudioController.sounds.toggle.volume = 0.03;
AudioController.sounds.dropdownOpen.volume = 0.05;
AudioController.sounds.dropdownSelect.volume = 0.2;

// ─── TITLEBAR CONTROLS ────────────────────────────────────────────────────────
document.getElementById('btn-minimize').addEventListener('click', () => window.riftVaultAPI.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.riftVaultAPI.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.riftVaultAPI.close());

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

    // Animate stats counting - Only once per session
    if (!isAnimatingStats) {
        countUp(totalEl, stats.total);
        isAnimatingStats = true;
    } else {
        totalEl.textContent = stats.total; // Direct push if already animated
    }

    for (const [rarity, count] of Object.entries(stats.byRarity)) {
        const el = document.getElementById(`gem-${rarity}`);
        if (el) el.textContent = count;
    }
    document.getElementById('stat-legacy').textContent = stats.legacy;
    document.getElementById('stat-chromas').textContent = stats.ownedChromas;
}

// ─── WISHLIST HELPERS ─────────────────────────────────────────────────────────
function loadWishlist() {
    try {
        const stored = localStorage.getItem('wishlist');
        if (stored) wishlist = new Set(JSON.parse(stored));
    } catch { wishlist = new Set(); }
}

function saveWishlist() {
    localStorage.setItem('wishlist', JSON.stringify([...wishlist]));
}

function toggleWishlist(skinId) {
    if (wishlist.has(skinId)) {
        wishlist.delete(skinId);
    } else {
        wishlist.add(skinId);
        addToWishlistHistory(skinId);
    }
    saveWishlist();
}

// ─── WISHLIST HISTORY ─────────────────────────────────────────────────────────
function loadWishlistHistory() {
    try {
        const stored = localStorage.getItem('wishlistHistory');
        if (stored) wishlistHistory = new Set(JSON.parse(stored));
    } catch { wishlistHistory = new Set(); }
}

function saveWishlistHistory() {
    localStorage.setItem('wishlistHistory', JSON.stringify([...wishlistHistory]));
}

function addToWishlistHistory(skinId) {
    if (!wishlistHistory.has(skinId)) {
        wishlistHistory.add(skinId);
        saveWishlistHistory();
    }
}

// ─── ACHIEVEMENTS PERSISTENCE ─────────────────────────────────────────────────
function loadEarnedAchievements() {
    try {
        const stored = localStorage.getItem('achievements');
        return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
}

function saveEarnedAchievements(data) {
    localStorage.setItem('achievements', JSON.stringify(data));
}

// ─── ACHIEVEMENT CONDITION EVALUATOR ─────────────────────────────────────────
function evaluateCondition(cond, skins, wHistory, prices) {
    const owned = skins.filter(s => s.owned && !s.isBase);

    switch (cond.type) {
        case 'owned_count':
            return owned.length >= cond.min;

        case 'chroma_count': {
            const total = owned.reduce((n, s) => n + (s.chromas ? s.chromas.owned : 0), 0);
            return total >= cond.min;
        }

        case 'legacy_count':
            return owned.filter(s => s.isLegacy).length >= cond.min;

        case 'prestige_count':
            return owned.filter(s => /prestige/i.test(s.name)).length >= cond.min;

        case 'rarity_own':
            return owned.some(s => s.rarity === cond.rarity);

        case 'specific_skins': {
            const ownedIds = new Set(skins.filter(s => s.owned).map(s => s.id));
            if (cond.mode === 'all') return cond.skinIds.every(id => ownedIds.has(id));
            return cond.skinIds.some(id => ownedIds.has(id));
        }

        case 'champion_complete': {
            const min = cond.minSkins || 3;
            const champOwned = {}, champTotal = {};
            for (const s of skins) {
                if (s.isBase) continue;
                champTotal[s.championId] = (champTotal[s.championId] || 0) + 1;
                if (s.owned) champOwned[s.championId] = (champOwned[s.championId] || 0) + 1;
            }
            if (cond.champId !== 0) {
                const t = champTotal[cond.champId] || 0;
                return t >= min && (champOwned[cond.champId] || 0) === t;
            }
            return Object.keys(champTotal).some(id =>
                champTotal[id] >= min && (champOwned[id] || 0) === champTotal[id]
            );
        }

        case 'skinline_complete': {
            const min = cond.minSkins || 3;
            const lineOwned = {}, lineTotal = {};
            for (const s of skins) {
                if (s.isBase || !s.skinLines || !s.skinLines.length) continue;
                for (const line of s.skinLines) {
                    const lid = String(line.id);
                    lineTotal[lid] = (lineTotal[lid] || 0) + 1;
                    if (s.owned) lineOwned[lid] = (lineOwned[lid] || 0) + 1;
                }
            }
            if (cond.lineId !== 0) {
                const lid = String(cond.lineId);
                const t = lineTotal[lid] || 0;
                return t >= min && (lineOwned[lid] || 0) === t;
            }
            return Object.keys(lineTotal).some(lid =>
                lineTotal[lid] >= min && (lineOwned[lid] || 0) === lineTotal[lid]
            );
        }

        case 'chroma_complete_any':
            return owned.some(s =>
                s.chromas && s.chromas.total > 0 && s.chromas.owned === s.chromas.total
            );

        case 'wishlist_count':
            return wishlist.size >= cond.min;

        case 'wishlist_history': {
            const ownedIds = new Set(skins.filter(s => s.owned).map(s => s.id));
            const matches = [...wHistory].filter(id => ownedIds.has(id)).length;
            return matches >= cond.min;
        }

        case 'rp_value': {
            if (!prices || !Object.keys(prices).length) return false;
            let total = 0;
            for (const s of owned) {
                let cn = s.championName.toLowerCase().replace(/[^a-z0-9]/g, '');
                let sn = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (sn !== cn && sn.includes(cn)) sn = sn.replace(cn, '');
                const cost = prices[`${cn}_${sn}`];
                if (cost && cost !== 'Special') { const rp = parseInt(cost, 10); if (!isNaN(rp)) total += rp; }
            }
            return total >= cond.min;
        }

        case 'one_champion_pct': {
            if (owned.length < cond.minOwned) return false;
            const counts = {};
            for (const s of owned) counts[s.championId] = (counts[s.championId] || 0) + 1;
            const maxCount = Math.max(...Object.values(counts));
            return maxCount / owned.length >= cond.pct;
        }

        default:
            return false;
    }
}

// ─── ACHIEVEMENT SCAN ─────────────────────────────────────────────────────────
function scanAchievements() {
    if (!achievements.length || !allSkins.length) return [];
    const stored = loadEarnedAchievements();
    const now = Date.now();
    const newlyEarned = [];

    for (const ach of achievements) {
        if (stored[ach.id]) continue;
        if (evaluateCondition(ach.condition, allSkins, wishlistHistory, rpPrices)) {
            stored[ach.id] = now;
            newlyEarned.push(ach);
        }
    }

    if (newlyEarned.length) {
        saveEarnedAchievements(stored);
        earnedAchievements = stored;
    } else {
        earnedAchievements = stored;
    }

    return newlyEarned;
}

// ─── ACHIEVEMENT INIT (called after allSkins or prices load) ─────────────────
function initAchievements() {
    if (!achievements.length || !allSkins.length) return;

    const isFirstRun = !localStorage.getItem('achievementsInitialized');
    const newlyEarned = scanAchievements();

    if (isFirstRun) {
        localStorage.setItem('achievementsInitialized', '1');
        const total = Object.keys(earnedAchievements).length;
        if (total > 0) showAchievementsWelcome(total);
    } else if (newlyEarned.length) {
        newlyEarned.forEach(ach => showAchievementToast(ach));
        showNewUnlockDot();
    }
}

// ─── ACHIEVEMENT TOAST ────────────────────────────────────────────────────────
function showAchievementToast(ach) {
    const container = document.getElementById('achievement-toast-container');
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <span class="toast-icon">${ach.icon}</span>
        <div class="toast-text">
            <span class="toast-label">Achievement Unlocked</span>
            <span class="toast-name">${ach.name}</span>
            <span class="toast-desc">${ach.description}</span>
        </div>
    `;
    container.appendChild(toast);
    AudioController.play('toggle');

    setTimeout(() => {
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 5000);
}

// ─── NEW UNLOCK DOT ON TITLEBAR BUTTON ───────────────────────────────────────
function showNewUnlockDot() {
    const btn = document.getElementById('btn-achievements-tab');
    if (!btn || btn.classList.contains('active') || btn.querySelector('.new-dot')) return;
    const dot = document.createElement('span');
    dot.className = 'new-dot';
    btn.appendChild(dot);
}

// ─── ACHIEVEMENTS WELCOME MODAL ───────────────────────────────────────────────
function showAchievementsWelcome(count) {
    const modal = document.getElementById('achievements-welcome');
    document.getElementById('aw-count-num').textContent = count;
    modal.style.display = 'flex';

    document.getElementById('aw-view-btn').onclick = () => {
        modal.style.display = 'none';
        TabManager.openAchievementsTab();
    };
    document.getElementById('aw-dismiss-btn').onclick = () => {
        modal.style.display = 'none';
    };
}

// ─── RENDER ACHIEVEMENTS GRID ─────────────────────────────────────────────────
const CATEGORY_LABELS = {
    milestone:     'Milestones',
    rarity:        'Rarity',
    completionist: 'Completionist',
    discovery:     'Discovery',
    meta:          'App',
    curator:       'Curator Picks',
};

const CATEGORY_ORDER = ['milestone', 'rarity', 'completionist', 'discovery', 'meta', 'curator'];

function renderAchievementsGrid() {
    const scroll = document.getElementById('achievements-scroll');
    const label = document.getElementById('achievements-count-label');
    if (!scroll) return;
    scroll.innerHTML = '';

    const total = Object.keys(earnedAchievements).length;
    label.textContent = `${total} of ${achievements.length} achievements earned`;

    if (!achievements.length) {
        scroll.innerHTML = `<div class="achievements-empty">
            <div class="empty-icon">🏆</div>
            <h2>No achievements loaded</h2>
            <p>Check that achievements.json is present in the app folder.</p>
        </div>`;
        return;
    }

    const groups = {};
    for (const ach of achievements) {
        const cat = ach.category || 'meta';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(ach);
    }

    const orderedCats = CATEGORY_ORDER.filter(c => groups[c]);

    for (const cat of orderedCats) {
        const section = document.createElement('div');
        section.className = 'achievements-section';

        const sectionLabel = document.createElement('div');
        sectionLabel.className = 'achievements-section-label';
        sectionLabel.textContent = CATEGORY_LABELS[cat] || cat;
        section.appendChild(sectionLabel);

        const grid = document.createElement('div');
        grid.className = 'achievements-grid';

        for (const ach of groups[cat]) {
            grid.appendChild(createAchievementCard(ach));
        }

        section.appendChild(grid);
        scroll.appendChild(section);
    }
}

function createAchievementCard(ach) {
    const earned = !!earnedAchievements[ach.id];
    const card = document.createElement('div');
    card.className = `achievement-card ${earned ? 'earned' : 'locked'}`;
    card.dataset.tier = ach.tier || 'bronze';

    const tierChip = `<span class="achievement-tier-chip" data-tier="${ach.tier || 'bronze'}">${(ach.tier || 'bronze').toUpperCase()}</span>`;
    const unlockDate = earned
        ? `<div class="achievement-unlock-date">Unlocked ${new Date(earnedAchievements[ach.id]).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>`
        : '';
    const curatorBadge = ach.streamer
        ? `<div class="achievement-curator-badge">⭐ ${ach.streamer}'s Pick</div>`
        : '';
    const disclaimer = ach.disclaimer
        ? `<div class="achievement-disclaimer">${ach.disclaimer}</div>`
        : '';
    const shareBtn = earned
        ? `<button class="achievement-share-btn" data-id="${ach.id}">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
               Save Card
           </button>`
        : '';

    card.innerHTML = `
        <div class="achievement-card-top">
            <span class="achievement-icon">${ach.icon}</span>
            ${tierChip}
        </div>
        <div class="achievement-name">${ach.name}</div>
        <div class="achievement-desc">${ach.description}</div>
        ${curatorBadge}
        ${unlockDate}
        ${disclaimer}
        ${shareBtn}
    `;

    if (earned) {
        const btn = card.querySelector('.achievement-share-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                generateAndSaveShareCard(ach);
            });
        }
    }

    return card;
}

// ─── SHARE CARD GENERATOR ─────────────────────────────────────────────────────
const TIER_COLORS = {
    bronze: '#cd7f32',
    silver: '#a8a9ad',
    gold:   '#c89b3c',
    mythic: '#ee4fa0',
};

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, cy);
            line = word;
            cy += lineHeight;
        } else {
            line = test;
        }
    }
    if (line) ctx.fillText(line, x, cy);
    return cy;
}

function canvasRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function generateAndSaveShareCard(ach) {
    const canvas = document.getElementById('share-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 900;
    canvas.height = 500;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 900, 500);
    bg.addColorStop(0, '#0c1119');
    bg.addColorStop(1, '#080c14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 900, 500);

    // Subtle radial glow at center
    const glow = ctx.createRadialGradient(450, 250, 50, 450, 250, 350);
    glow.addColorStop(0, 'rgba(200,155,60,0.06)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 900, 500);

    // Outer border
    ctx.strokeStyle = '#c89b3c';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 876, 476);

    // Inner faint border
    ctx.strokeStyle = 'rgba(200,155,60,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, 864, 464);

    // Tier accent bar (left edge)
    const tierColor = TIER_COLORS[ach.tier] || TIER_COLORS.gold;
    ctx.fillStyle = tierColor;
    ctx.fillRect(12, 12, 4, 476);

    // Large icon
    ctx.font = '70px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ach.icon, 112, 220);

    // Vertical divider
    ctx.strokeStyle = 'rgba(200,155,60,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(196, 50);
    ctx.lineTo(196, 450);
    ctx.stroke();

    // "RIFTVAULT — ACHIEVEMENT UNLOCKED" header
    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillStyle = '#7b8a9e';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('RIFTVAULT  —  ACHIEVEMENT UNLOCKED', 216, 60);

    // Achievement name
    ctx.font = '700 32px Cinzel, serif';
    ctx.fillStyle = '#f0e6d2';
    ctx.textBaseline = 'top';
    ctx.fillText(ach.name, 216, 105);

    // Tier chip
    const chipText = (ach.tier || 'bronze').toUpperCase();
    ctx.font = '700 10px Inter, sans-serif';
    const chipW = ctx.measureText(chipText).width + 16;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = tierColor;
    canvasRoundRect(ctx, 216, 158, chipW, 20, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = tierColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(chipText, 224, 168);

    // Category label
    const catLabel = (CATEGORY_LABELS[ach.category] || ach.category || '').toUpperCase();
    ctx.font = '400 10px Inter, sans-serif';
    ctx.fillStyle = '#7b8a9e';
    ctx.fillText(catLabel, 216 + chipW + 10, 168);

    // Description
    ctx.font = '400 15px Inter, sans-serif';
    ctx.fillStyle = '#a09b8c';
    ctx.textBaseline = 'top';
    wrapCanvasText(ctx, ach.description, 216, 200, 640, 22);

    // Unlock date
    if (earnedAchievements[ach.id]) {
        const date = new Date(earnedAchievements[ach.id]).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.font = '400 12px Inter, sans-serif';
        ctx.fillStyle = '#7b8a9e';
        ctx.textBaseline = 'top';
        ctx.fillText(`Unlocked ${date}`, 216, 295);
    }

    // Summoner name
    if (shareShowSummoner && summoner) {
        const name = summoner.gameName || summoner.displayName || '';
        if (name) {
            ctx.font = '600 18px Inter, sans-serif';
            ctx.fillStyle = '#c89b3c';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(name, 216, 450);
        }
    }

    // Curator disclaimer
    if (ach.disclaimer) {
        ctx.font = 'italic 9px Inter, sans-serif';
        ctx.fillStyle = 'rgba(123,138,158,0.55)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(ach.disclaimer, 216, 475);
    }

    // Riot attribution
    ctx.font = '400 9px Inter, sans-serif';
    ctx.fillStyle = 'rgba(123,138,158,0.3)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Uses assets by Riot Games. Not endorsed by Riot Games.', 882, 462);

    // RiftVault watermark
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(200,155,60,0.35)';
    ctx.fillText('riftvault', 882, 478);

    // Export to PNG and save via Electron
    canvas.toBlob(async (blob) => {
        const arrayBuffer = await blob.arrayBuffer();
        const safeName = ach.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        await window.riftVaultAPI.saveShareCard([...new Uint8Array(arrayBuffer)], `riftvault-${safeName}.png`);
    }, 'image/png');
}

// ─── ACHIEVEMENTS DATA LOADER ─────────────────────────────────────────────────
async function loadAchievementsData() {
    try {
        const [achRes, curatorRes, takedownsRes] = await Promise.all([
            fetch('./achievements.json'),
            fetch('./curator-picks.json'),
            fetch('./curator-takedowns.json'),
        ]);

        const achData = await achRes.json();
        const curatorData = await curatorRes.json();
        const takedowns = new Set(await takedownsRes.json());

        const base = achData.achievements || [];
        const curator = curatorData.filter(c => !takedowns.has(c.id));
        achievements = [...base, ...curator];

        initAchievements();
    } catch (err) {
        console.warn('[Achievements] Failed to load data:', err.message);
    }
}

function pruneWishlistAgainstOwned() {
    let pruned = false;
    for (const s of allSkins) {
        if (s.owned && wishlist.has(s.id)) {
            wishlist.delete(s.id);
            pruned = true;
        }
    }
    if (pruned) saveWishlist();
}

// ─── COLLECTION VALUE ────────────────────────────────────────────────────────
function calculateCollectionValue() {
    let totalRP = 0;
    let pricedCount = 0;
    for (const skin of allSkins) {
        if (!skin.owned || skin.isBase) continue;
        let cleanChampName = skin.championName.toLowerCase().replace(/[^a-z0-9]/g, '');
        let cleanSkinName = skin.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanSkinName !== cleanChampName && cleanSkinName.includes(cleanChampName)) {
            cleanSkinName = cleanSkinName.replace(cleanChampName, '');
        }
        const key = `${cleanChampName}_${cleanSkinName}`;
        const cost = rpPrices[key];
        if (cost && cost !== 'Special') {
            const rp = parseInt(cost, 10);
            if (!isNaN(rp)) {
                totalRP += rp;
                pricedCount++;
            }
        }
    }
    return { totalRP, pricedCount };
}

function updateCollectionValue() {
    const { totalRP } = calculateCollectionValue();
    const valueEl = document.getElementById('stat-value-rp');
    const usdEl = document.getElementById('stat-value-usd');
    if (valueEl) {
        valueEl.textContent = totalRP.toLocaleString();
    }
    if (usdEl) {
        const usd = (totalRP * 0.0069).toFixed(2);
        usdEl.textContent = `≈ $${usd}`;
    }
}

// ─── FILTER & RENDER ─────────────────────────────────────────────────────────
function applyFilters() {
    const q = searchQuery.toLowerCase();
    filteredSkins = allSkins.filter(s => {
        if (!showUnowned && !s.owned) return false;
        if (!showBase && s.isBase) return false;
        if (filterLegacyOnly && !s.isLegacy) return false;
        if (filterPrestigeOnly && !/prestige/i.test(s.name)) return false;
        if (filterWishlistOnly && !wishlist.has(s.id)) return false;
        if (q && !s.name.toLowerCase().includes(q) && !s.championName.toLowerCase().includes(q)) return false;
        return true;
    });
    renderGrid(filteredSkins);
}

function getSortedGroups(skins) {
    if (groupBy === 'all') {
        return [{ key: 'all', label: 'ALL SKINS', skins }];
    }

    // Pre-calculate the true absolute totals for every group bypassing the filters.
    // For "set", a single skin can belong to multiple skin lines — count it in each.
    const trueCounts = {};
    const bumpCount = (key, owned) => {
        if (!trueCounts[key]) trueCounts[key] = { owned: 0, total: 0 };
        trueCounts[key].total++;
        if (owned) trueCounts[key].owned++;
    };
    for (const s of allSkins) {
        if (s.isBase) continue; // Sets/tiers should ignore base skins in the denominator
        if (groupBy === 'champion') {
            bumpCount(s.championKey, s.owned);
        } else if (groupBy === 'tier') {
            bumpCount(s.rarity, s.owned);
        } else if (groupBy === 'set') {
            const lines = (s.skinLines && s.skinLines.length) ? s.skinLines : [{ id: 'other' }];
            for (const line of lines) {
                bumpCount(String(line.id), s.owned);
            }
        }
    }

    const groups = {};
    const ensureGroup = (key, label) => {
        if (!groups[key]) {
            const tc = trueCounts[key] || { owned: 0, total: 0 };
            groups[key] = {
                key, label, skins: [],
                owned: tc.owned,
                total: tc.total,
                mastery: 0,
            };
        }
        return groups[key];
    };

    for (const s of skins) {
        if (groupBy === 'champion') {
            const g = ensureGroup(s.championKey, s.championName);
            g.skins.push(s);
            if (s.mastery) g.mastery = Math.max(g.mastery, s.mastery.points || 0);
        } else if (groupBy === 'tier') {
            const g = ensureGroup(s.rarity, s.rarity.charAt(0).toUpperCase() + s.rarity.slice(1));
            g.skins.push(s);
        } else if (groupBy === 'set') {
            if (s.isBase) continue; // base skins have no set association
            const lines = (s.skinLines && s.skinLines.length) ? s.skinLines : [{ id: 'other' }];
            for (const line of lines) {
                const lineId = String(line.id);
                const label = lineId === 'other' ? 'Other' : (skinLineNames[lineId] || `Set ${lineId}`);
                const g = ensureGroup(lineId, label);
                g.skins.push(s);
                if (s.mastery) g.mastery = Math.max(g.mastery, s.mastery.points || 0);
            }
        }
    }

    let sorted = Object.values(groups);

    const pct = (g) => g.total > 0 ? g.owned / g.total : 0;

    if (groupBy === 'tier') {
        sorted.sort((a, b) => (RARITY_ORDER[a.key] ?? 99) - (RARITY_ORDER[b.key] ?? 99));
    } else if (groupBy === 'champion') {
        if (sortBy === 'mastery') {
            sorted.sort((a, b) => b.mastery - a.mastery);
        } else if (sortBy === 'most-owned') {
            sorted.sort((a, b) => b.owned - a.owned);
        } else if (sortBy === 'most-complete') {
            sorted.sort((a, b) => pct(b) - pct(a));
        } else {
            sorted.sort((a, b) => a.label.localeCompare(b.label));
        }
    } else if (groupBy === 'set') {
        // 'Other' always pinned to the bottom
        const otherLast = (a, b) => {
            if (a.key === 'other') return 1;
            if (b.key === 'other') return -1;
            return 0;
        };
        if (sortBy === 'mastery') {
            sorted.sort((a, b) => otherLast(a, b) || (b.mastery - a.mastery));
        } else if (sortBy === 'most-owned') {
            sorted.sort((a, b) => otherLast(a, b) || (b.owned - a.owned));
        } else if (sortBy === 'most-complete') {
            sorted.sort((a, b) => otherLast(a, b) || (pct(b) - pct(a)));
        } else {
            sorted.sort((a, b) => otherLast(a, b) || a.label.localeCompare(b.label));
        }
    }

    // Sort skins within each group: owned first, then by skinName alphabetical, then by skinNum
    for (const g of sorted) {
        g.skins.sort((a, b) => {
            if (a.owned !== b.owned) return a.owned ? -1 : 1;
            
            if (sortBy === 'mastery') {
                const aMastery = a.mastery ? (a.mastery.points || 0) : 0;
                const bMastery = b.mastery ? (b.mastery.points || 0) : 0;
                if (aMastery !== bMastery) return bMastery - aMastery;
            }
            
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;
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
            const isComplete = group.owned === group.total && group.total > 0;
            header.className = 'group-header' + (isComplete ? ' group-complete' : '');
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

function scrollToChampion(champId) {
    if (!filteredSkins || filteredSkins.length === 0) return;

    // Attempt to find the first card or header belonging to the champ
    const targetCard = Array.from(document.querySelectorAll('.skin-card')).find(card => {
        return card.dataset.champId === String(champId);
    });

    if (targetCard) {
        // Find the group header if grouping by champion
        let targetElement = targetCard;
        if (groupBy === 'champion') {
            let prev = targetCard.previousElementSibling;
            while (prev && !prev.classList.contains('group-header')) {
                prev = prev.previousElementSibling;
                if (!prev) break;
            }
            if (prev) targetElement = prev;
        }

        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Add a subtle highlight flash
        targetCard.style.outline = '2px solid var(--gold)';
        targetCard.style.outlineOffset = '2px';
        setTimeout(() => {
            targetCard.style.outline = '';
            targetCard.style.outlineOffset = '';
        }, 1500);
    }
}

// ─── SKIN CARD ────────────────────────────────────────────────────────────────
function createSkinCard(skin) {
    const card = document.createElement('div');
    card.className = `skin-card${!skin.owned ? ' unowned' : ''}`;
    card.dataset.champId = skin.championId;
    card.tabIndex = 0;

    // Wrapper to apply the mask to BOTH the image and the name overlay 
    // so the black gradient doesn't bleed out the bottom corners
    const maskWrapper = document.createElement('div');
    maskWrapper.className = 'skin-card-mask-wrapper';

    // Splash image
    const img = document.createElement('img');
    img.className = 'skin-card-img loading';
    img.alt = skin.name;
    img.loading = 'lazy';
    img.src = skin.loadingUrl;
    img.onload = () => img.classList.remove('loading');
    img.onerror = () => {
        img.classList.remove('loading');
        img.src = skin.splashUrl;
        img.onerror = () => (img.style.display = 'none');
    };
    maskWrapper.appendChild(img);

    // Name overlay
    const overlay = document.createElement('div');
    overlay.className = 'skin-card-overlay';
    overlay.innerHTML = `<div class="skin-card-name">${skin.name}</div>`;
    maskWrapper.appendChild(overlay);

    card.appendChild(maskWrapper);

    // CDragon border overlay (outside mask wrapper so border flares aren't cropped)
    const borderSrc = BORDER_MAP[skin.rarity] || BORDER_MAP.standard;
    const borderImg = document.createElement('img');
    borderImg.className = 'skin-card-border';
    borderImg.src = borderSrc;
    borderImg.alt = '';
    borderImg.draggable = false;
    card.appendChild(borderImg);

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

            // Chroma Gallery Click Hook
            badge.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent modal opening
                AudioController.play('click');
                openChromaModal(skin);
            });
            card.appendChild(badge);
        }

        // Apply in Client — card-level icon button
        const applyBtn = document.createElement('button');
        applyBtn.className = 'card-apply-btn';
        applyBtn.dataset.tooltip = 'Apply in Client';
        applyBtn.dataset.skinId = skin.id;
        applyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>`;

        // Show immediately if champ select is already active and matches
        const skinChampId = Math.floor(skin.id / 1000);
        if (champSelectActive && champSelectChampId === skinChampId) {
            applyBtn.style.display = 'flex';
            // Mark as applied if this is the currently equipped skin
            if (champSelectSkinId === skin.id) {
                applyBtn.classList.add('applied');
                applyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
            }
        }

        applyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            AudioController.play('click');
            applyBtn.style.pointerEvents = 'none';
            const result = await window.riftVaultAPI.selectSkin(skin.id);
            if (result.success) {
                // Polling will update all buttons on the next tick
                applyBtn.classList.add('applied');
                applyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
            } else {
                applyBtn.classList.add('error');
                setTimeout(() => {
                    applyBtn.classList.remove('error');
                    applyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>`;
                    applyBtn.style.pointerEvents = '';
                }, 2000);
            }
        });
        card.appendChild(applyBtn);
    } else {
        // Lock icon for unowned
        const lock = document.createElement('div');
        lock.className = 'lock-icon';
        lock.innerHTML = `<img src="${LOCK_ICON}" alt="Unowned" draggable="false">`;
        card.appendChild(lock);

        // Wishlist heart for unowned skins
        const heart = document.createElement('button');
        heart.className = 'wishlist-btn' + (wishlist.has(skin.id) ? ' wishlisted' : '');
        const HEART_FILLED = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        const HEART_OUTLINE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        heart.innerHTML = wishlist.has(skin.id) ? HEART_FILLED : HEART_OUTLINE;
        heart.title = wishlist.has(skin.id) ? 'Remove from wishlist' : 'Add to wishlist';
        heart.addEventListener('click', (e) => {
            e.stopPropagation();
            AudioController.play('toggle');
            toggleWishlist(skin.id);
            const isNowWished = wishlist.has(skin.id);
            heart.className = 'wishlist-btn' + (isNowWished ? ' wishlisted' : '');
            heart.innerHTML = isNowWished ? HEART_FILLED : HEART_OUTLINE;
            heart.title = isNowWished ? 'Remove from wishlist' : 'Add to wishlist';
            if (filterWishlistOnly) applyFilters();
        });
        card.appendChild(heart);
    }

    card.addEventListener('mouseenter', () => AudioController.play('hover'));
    card.addEventListener('click', (e) => {
        // Prevent opening standard modal if interacting with Chroma Badge, Apply button, or Wishlist
        if (e.target.closest('.chroma-badge')) return;
        if (e.target.closest('.card-apply-btn')) return;
        if (e.target.closest('.wishlist-btn')) return;

        AudioController.play('click');
        openModal(skin);
    });

    // (Legacy tag logically disabled)

    return card;
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
const chromaBackdrop = document.getElementById('chroma-backdrop');
const chromaClose = document.getElementById('chroma-close');
const chromaGrid = document.getElementById('chroma-grid');

function openModal(skin) {
    const getWikiUrl = (name) => {
        let n = name;
        if (n === 'Nunu & Willump') n = 'Nunu';
        return 'https://wiki.leagueoflegends.com/en-us/' + n.replace(/ /g, '_').replace(/'/g, '%27');
    };

    modalChamp.textContent = skin.championName;
    modalName.textContent = skin.name;
    modalId.textContent = skin.isBase ? 'Base Skin' : skin.isLegacy ? 'Legacy Vault' : skin.rarity.toUpperCase();

    // Setup Price
    const priceNode = document.querySelector('.modal-price');
    if (skin.isBase) {
        priceNode.style.display = 'none';
    } else {
        priceNode.style.display = 'flex';
        let cleanChampName = skin.championName.toLowerCase().replace(/[^a-z0-9]/g, '');
        let cleanSkinName = skin.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Remove the champion name from the skin name if it's included, e.g "Lagoon Dragon Kai'Sa" -> "lagoondragon"
        if (cleanSkinName !== cleanChampName && cleanSkinName.includes(cleanChampName)) {
            cleanSkinName = cleanSkinName.replace(cleanChampName, '');
        }

        if (skin.isBase) cleanSkinName = "original";

        const key = `${cleanChampName}_${cleanSkinName}`;
        let cost = rpPrices[key];
        if (!cost || cost === 'Special') {
            document.getElementById('modal-price-text').textContent = 'NA (Special)';
        } else {
            document.getElementById('modal-price-text').textContent = cost;
        }
    }

    // Update Links
    wikiLink.onclick = (e) => {
        e.preventDefault();
        closeModal();
        TabManager.createTab(getWikiUrl(skin.championName), skin.championName + ' Wiki', '🌐');
    };
    modelLink.onclick = (e) => {
        e.preventDefault();
        closeModal();
        TabManager.createTab(`https://modelviewer.lol/model-viewer?id=${skin.id}`, skin.name + ' 3D', '🎮');
    };
    spotlightLink.onclick = (e) => {
        e.preventDefault();
        closeModal();
        const query = encodeURIComponent(skin.name + ' Spotlight').replace(/%20/g, '+');
        TabManager.createTab(`https://www.youtube.com/@SkinSpotlights/search?app=desktop&query=${query}`, skin.name + ' Spotlight', '📺');
    };

    modalBackdrop.style.display = 'flex';
    // Add open class after a tiny delay to allow display flex to apply
    requestAnimationFrame(() => {
        modalBackdrop.classList.add('open');
    });
    modalSplash.src = skin.splashUrl;
    modalBackdrop.style.display = 'flex';

    // ─── Apply in Client button logic ─────────────────────────────────────────
    const btnApply = document.getElementById('btn-apply-skin');
    const applySep = document.getElementById('apply-separator');
    const skinChampId = Math.floor(skin.id / 1000);
    const canApply = champSelectActive && skin.owned && champSelectChampId === skinChampId;

    if (canApply) {
        btnApply.style.display = 'inline-flex';
        applySep.style.display = '';
        btnApply.className = 'btn-apply-skin';
        btnApply.disabled = false;
        btnApply.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
            </svg>
            ${champSelectSkinId === skin.id ? 'Applied ✓' : 'Apply in Client'}
        `;
        if (champSelectSkinId === skin.id) {
            btnApply.classList.add('applied');
        }

        // Fresh click handler (remove old ones)
        const newBtn = btnApply.cloneNode(true);
        btnApply.parentNode.replaceChild(newBtn, btnApply);
        if (champSelectSkinId !== skin.id) {
            newBtn.addEventListener('click', async () => {
                newBtn.disabled = true;
                newBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
                    </svg>
                    Applying…
                `;
                const result = await window.riftVaultAPI.selectSkin(skin.id);
                if (result.success) {
                    newBtn.className = 'btn-apply-skin applied';
                    newBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                        Applied ✓
                    `;
                } else {
                    newBtn.className = 'btn-apply-skin error';
                    newBtn.innerHTML = `Failed`;
                    newBtn.disabled = false;
                    setTimeout(() => {
                        newBtn.className = 'btn-apply-skin';
                        newBtn.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
                            </svg>
                            Apply in Client
                        `;
                    }, 2000);
                }
            });
        }
    } else {
        btnApply.style.display = 'none';
        applySep.style.display = 'none';
    }
}

function openChromaModal(skin) {
    if (!skin.chromas || !skin.chromas.list) return;

    chromaGrid.innerHTML = '';

    // Sort chromas: owned first, then by ID
    const sortedChromas = [...skin.chromas.list].sort((a, b) => {
        const aOwned = a.ownership?.owned === true || a.owned === true || a.isOwned === true || a.unlocked === true;
        const bOwned = b.ownership?.owned === true || b.owned === true || b.isOwned === true || b.unlocked === true;
        if (aOwned === bOwned) return a.id - b.id;
        return aOwned ? -1 : 1;
    });

    sortedChromas.forEach(c => {
        // Obey Show Unowned Toggle
        const isOwned = c.ownership?.owned === true || c.owned === true || c.isOwned === true || c.unlocked === true;
        if (!showUnowned && !isOwned) return;

        // LCU port 127.0.0.1 requires SSL auth headers which img src cannot provide. Force CDragon plugin images.
        const pathUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-chroma-images/${skin.championId}/${c.id}.png`;

        const cNode = document.createElement('div');
        cNode.className = `chroma-item ${isOwned ? '' : 'locked'}`;
        cNode.title = c.name || `Chroma ID: ${c.id}`;

        const img = document.createElement('img');
        img.className = 'chroma-img';
        img.src = pathUrl;
        img.draggable = false;

        cNode.appendChild(img);
        chromaGrid.appendChild(cNode);
    });

    chromaBackdrop.style.display = 'flex';
}

function closeModal() {
    AudioController.play('release');
    modalBackdrop.style.display = 'none';
    chromaBackdrop.style.display = 'none';
    modalSplash.src = '';
}

modalClose.addEventListener('click', closeModal);
chromaClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
chromaBackdrop.addEventListener('click', (e) => { if (e.target === chromaBackdrop) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

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
        <img class="summoner-avatar" src="${sum.profileIconUrl}" alt="icon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDBwJSIgaGVpZ2h0PSIxMDBwJSI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzAxMGExMyIvPjwvc3ZnPg=='"/>
        <div class="summoner-level-wrapper">
          <div class="summoner-level"><span>${sum.summonerLevel}</span></div>
        </div>
      </div>
      <div class="summoner-details">
        <div class="summoner-name">${sum.gameName || sum.displayName || 'Summoner'}</div>
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
        const cached = await window.riftVaultAPI.getCachedSkins();
        if (cached && cached.success) {
            const data = cached.data;
            summoner = data.summoner;
            allSkins = data.skins;
            LCU_PORT = data.lcuPort;
            pruneWishlistAgainstOwned();
            renderSummonerHeader(summoner, 'connecting'); // Render as connecting
            if (data.stats) updateStatsPanel(data.stats);
            if (data.skinLineNames) skinLineNames = data.skinLineNames;
            applyFilters();
            if (Object.keys(rpPrices).length > 0) updateCollectionValue();
            initAchievements();
            hideLoading(); // MUST CALL THIS to clear the default loading overlay
        }
    }

    // 2. Only show loading block if we have completely empty cache
    if (!isRefresh && allSkins.length === 0) {
        showLoading('Connecting to League Client…');
    }

    // 2. Fetch RP prices in background
    window.riftVaultAPI.getSkinPrices().then(res => {
        if (res.success) {
            rpPrices = res.data;
            if (allSkins.length > 0) {
                updateCollectionValue();
                initAchievements(); // re-scan now that RP prices are available
            }
        }
    }).catch(e => console.error("Failed to load RP prices", e));

    // 3. Perform live sync
    try {
        const res = isRefresh ? await window.riftVaultAPI.refreshSkins() : await window.riftVaultAPI.getSkins();

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
        LCU_PORT = data.lcuPort;
        allSkins = data.skins.map(s => ({ ...s, version: data.version }));
        pruneWishlistAgainstOwned();

        renderSummonerHeader(summoner, 'connected'); // Connected
        if (data.stats) updateStatsPanel(data.stats);
        if (data.skinLineNames) skinLineNames = data.skinLineNames;
        applyFilters();
        if (Object.keys(rpPrices).length > 0) updateCollectionValue();
        initAchievements();
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
    localStorage.setItem('showUnowned', showUnowned);
    applyFilters();
});

document.getElementById('toggle-base').addEventListener('change', (e) => {
    AudioController.play('toggle');
    showBase = e.target.checked;
    localStorage.setItem('showBase', showBase);
    applyFilters();
});

// ─── WISHLIST TAB BUTTON ──────────────────────────────────────────────────────
document.getElementById('btn-wishlist-tab').addEventListener('click', () => {
    AudioController.play('toggle');
    TabManager.openWishlistTab();
});

// ─── ACHIEVEMENTS TAB BUTTON ──────────────────────────────────────────────────
document.getElementById('btn-achievements-tab').addEventListener('click', () => {
    AudioController.play('toggle');
    TabManager.openAchievementsTab();
});

// ─── DROPDOWN LOGIC ───────────────────────────────────────────────────────────

// Sort options available per group mode.
// `all` and `tier` have no user-selectable sort — the menu is locked to a fixed label.
// `down` = desc arrow (▼), `up` = asc arrow (▲), null = no arrow
const SORT_OPTIONS = {
    champion: [
        { value: 'mastery',       label: 'Mastery',         arrow: 'down' },
        { value: 'most-owned',    label: 'Most Owned',      arrow: 'down' },
        { value: 'most-complete', label: 'Most Complete %', arrow: 'down' },
        { value: 'alpha',         label: 'Alphabetical',    arrow: 'up'   },
    ],
    set: [
        { value: 'most-owned',    label: 'Most Owned',      arrow: 'down' },
        { value: 'most-complete', label: 'Most Complete %', arrow: 'down' },
        { value: 'alpha',         label: 'Alphabetical',    arrow: 'up'   },
    ],
    all:  { locked: 'Alphabetical', forcedValue: 'alpha' },
    tier: { locked: 'Tier',         forcedValue: 'tier'  },
};

const ARROW_GLYPH = { down: ' ▼', up: ' ▲' };

function formatSortLabel(opt) {
    return opt.label + (opt.arrow ? ARROW_GLYPH[opt.arrow] : '');
}

function rebuildSortMenu() {
    const menu = document.getElementById('sort-menu');
    const label = document.getElementById('sort-label');
    const wrap = document.getElementById('sort-dropdown');
    const btn = wrap.querySelector('.dropdown-btn');

    menu.innerHTML = '';
    const config = SORT_OPTIONS[groupBy];

    // Locked modes: show greyed out label, close the dropdown, force sortBy
    if (config && config.locked) {
        wrap.classList.add('locked');
        btn.disabled = true;
        label.textContent = config.locked;
        sortBy = config.forcedValue;
        return;
    }

    wrap.classList.remove('locked');
    btn.disabled = false;

    const options = config; // array
    // If current sortBy isn't valid for this group mode, fall back to the first option
    if (!options.some(o => o.value === sortBy)) {
        sortBy = options[0].value;
        localStorage.setItem('sortBy', sortBy);
    }

    for (const opt of options) {
        const item = document.createElement('button');
        item.className = 'dropdown-item' + (opt.value === sortBy ? ' active' : '');
        item.dataset.value = opt.value;
        item.innerHTML = `${formatSortLabel(opt)}<span class="check">✓</span>`;
        item.addEventListener('click', () => {
            AudioController.play('dropdownSelect');
            sortBy = opt.value;
            localStorage.setItem('sortBy', sortBy);
            rebuildSortMenu();
            menu.classList.remove('open');
            applyFilters();
        });
        menu.appendChild(item);
    }

    // Update the visible label to match the active sort
    const active = options.find(o => o.value === sortBy);
    if (active) label.textContent = formatSortLabel(active);
}

function setupDropdown(wrapId, menuId, labelId, onChange) {
    const wrap = document.getElementById(wrapId);
    const menu = document.getElementById(menuId);
    const label = document.getElementById(labelId);
    const btn = wrap.querySelector('.dropdown-btn');

    btn.addEventListener('click', () => {
        if (wrap.classList.contains('locked')) return;
        const isOpen = menu.classList.contains('open');
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
    localStorage.setItem('groupBy', groupBy);
    rebuildSortMenu();
    applyFilters();
});

// Sort dropdown: items are built dynamically by rebuildSortMenu().
// Attach its own open/close handler since setupDropdown can't wire dynamic items.
(function setupSortDropdownToggle() {
    const wrap = document.getElementById('sort-dropdown');
    const menu = document.getElementById('sort-menu');
    const btn = wrap.querySelector('.dropdown-btn');
    btn.addEventListener('click', () => {
        if (wrap.classList.contains('locked')) return;
        const isOpen = menu.classList.contains('open');
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
        if (!isOpen) {
            AudioController.play('dropdownOpen');
            menu.classList.add('open');
        }
    });
})();

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

// Load previously saved states from localStorage
if (localStorage.getItem('showUnowned') !== null) {
    showUnowned = localStorage.getItem('showUnowned') === 'true';
    document.getElementById('toggle-unowned').checked = showUnowned;
}
if (localStorage.getItem('showBase') !== null) {
    showBase = localStorage.getItem('showBase') === 'true';
    document.getElementById('toggle-base').checked = showBase;
}
if (localStorage.getItem('groupBy')) {
    groupBy = localStorage.getItem('groupBy');
    // Migrate legacy value from a previous build
    if (groupBy === 'skinline') {
        groupBy = 'set';
        localStorage.setItem('groupBy', groupBy);
    }
}
if (localStorage.getItem('sortBy')) {
    sortBy = localStorage.getItem('sortBy');
}

// Preset the group dropdown label + active state to match stored value
function initDropdownVisuals(menuId, labelId, value) {
    const menu = document.getElementById(menuId);
    const label = document.getElementById(labelId);
    menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.toggle('active', item.dataset.value === value);
        if (item.dataset.value === value) label.textContent = item.textContent.replace('✓', '').trim();
    });
}
initDropdownVisuals('group-menu', 'group-label', groupBy);

// Build the sort dropdown based on current groupBy (also handles locked modes)
rebuildSortMenu();

// (Wishlist now managed by TabManager, no localStorage restore needed)

loadWishlist();
loadWishlistHistory();

// Share card summoner toggle
if (localStorage.getItem('shareShowSummoner') !== null) {
    shareShowSummoner = localStorage.getItem('shareShowSummoner') === 'true';
}
const toggleShareSumm = document.getElementById('toggle-share-summoner');
if (toggleShareSumm) {
    toggleShareSumm.checked = shareShowSummoner;
    toggleShareSumm.addEventListener('change', (e) => {
        shareShowSummoner = e.target.checked;
        localStorage.setItem('shareShowSummoner', shareShowSummoner);
    });
}

document.getElementById('github-link').addEventListener('click', (e) => { e.preventDefault(); window.riftVaultAPI.openExternal('https://github.com/arjun-arihant/RiftVault'); });

loadAchievementsData();
loadSkins(false);

if (window.riftVaultAPI.onLiveGameEvent) {
    window.riftVaultAPI.onLiveGameEvent((event) => {
        if (event.type === 'champ-hover' && event.championId) {
            scrollToChampion(event.championId);
        }
        if (event.type === 'champ-select-state') {
            champSelectActive = event.active;
            champSelectChampId = event.championId || 0;
            champSelectSkinId = event.currentSkinId || 0;

            // Live-refresh the Apply button if modal is currently open
            const btnApply = document.getElementById('btn-apply-skin');
            const applySep = document.getElementById('apply-separator');
            if (modalBackdrop.style.display !== 'none' && btnApply) {
                if (!event.active) {
                    btnApply.style.display = 'none';
                    applySep.style.display = 'none';
                }
            }

            // Toggle card-level apply buttons + sync applied state
            const APPLY_DEFAULT_SVG = `<svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>`;
            const APPLY_CHECK_SVG = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
            document.querySelectorAll('.card-apply-btn').forEach(btn => {
                const sid = parseInt(btn.dataset.skinId, 10);
                const cid = Math.floor(sid / 1000);
                if (event.active && event.championId === cid) {
                    btn.style.display = 'flex';
                    // Sync applied state: green check on currently equipped skin, default on others
                    if (event.currentSkinId === sid) {
                        btn.classList.add('applied');
                        btn.classList.remove('error');
                        btn.innerHTML = APPLY_CHECK_SVG;
                    } else {
                        btn.classList.remove('applied', 'error');
                        btn.style.pointerEvents = '';
                        btn.innerHTML = APPLY_DEFAULT_SVG;
                    }
                } else {
                    btn.style.display = 'none';
                    btn.classList.remove('applied', 'error');
                    btn.style.pointerEvents = '';
                    btn.innerHTML = APPLY_DEFAULT_SVG;
                }
            });
        }
    });
}
