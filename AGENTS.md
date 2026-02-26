# LoL Skin Viewer - Agent Documentation

## Project Overview

**LoL Skin Viewer** is an Electron-based desktop application for Windows that displays a League of Legends player's complete skin collection — both owned and unowned skins. It connects to the local League Client (LCU API) to retrieve skin data and enriches it with champion information, artwork, and rarity classification from Riot's Data Dragon and CommunityDragon APIs.

### Key Features
- **Complete Collection View** — Browse every skin for every champion, with owned skins highlighted and unowned skins dimmed with lock icons
- **Stats Dashboard** — Total skins owned, breakdown by rarity tier (Transcendent, Exalted, Ultimate, Mythic, Legendary, Epic), legacy count, and chroma ownership
- **Chroma Tracking** — See owned chroma count per skin displayed as a badge on each card
- **Group & Sort** — Group skins by Champion, Tier, or view All; Sort by Mastery, Most Owned, Most Complete %, or Alphabetically
- **Live Game Integration** — Automatically detects when you're in champ select or in-game and navigates to that champion's skins
- **Offline Mode** — Caches data locally to browse collection even when League client isn't running
- **Auto-Detection** — Automatically finds League Client installation across all drives using multiple strategies
- **Custom Frameless UI** — Dark theme inspired by League of Legends client with gold accents
- **System Tray** — Minimize to tray with quick refresh option

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Electron | ^33.3.1 |
| Main Process | Node.js (CommonJS) | require/module.exports |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) | - |
| Styling | Custom CSS with CSS variables | - |
| HTTP Client | Node.js native `https` module | - |
| External APIs | Riot LCU API, Data Dragon API, CommunityDragon | - |

### Fonts Used
- **Cinzel** — Decorative headers, titles, champion names
- **Inter** — UI text, body content

---

## Project Structure

```
LOL_skin_viewer/
├── main.js              # Electron main process - LCU API communication, caching, window management, game poller
├── preload.js           # Secure context bridge between main and renderer
├── renderer.js          # Frontend logic - UI rendering, search, filtering, grouping, modal management
├── index.html           # Main application UI markup
├── styles.css           # Application styling with dark theme and CSS variables
├── package.json         # Dependencies and scripts
├── .eslintrc.json       # ESLint configuration
├── .prettierrc          # Prettier code formatting rules
├── assets/              # Static assets
│   ├── borders/         # Tier-specific card border images (PNG)
│   ├── control-pane/    # Panel frame decorations (PNG)
│   └── tier-icons/      # Rarity gem icons and chroma icons (PNG)
└── AGENTS.md            # This file
```

### File Responsibilities

| File | Purpose |
|------|---------|
| `main.js` | Window creation, LCU lockfile detection, API calls to League Client, Data Dragon integration, CommunityDragon rarity data, local caching, live game polling |
| `preload.js` | Exposes secure API (`window.lolAPI`) to renderer for IPC communication |
| `renderer.js` | DOM manipulation, event handling, skin grid rendering, modal management, filtering, grouping, sorting, live game UI updates |
| `index.html` | Application layout with custom titlebar, sidebar panel, skin grid |
| `styles.css` | Dark theme styling with gold accent variables, animations, responsive grid, custom scrollbar |

---

## Architecture

### Electron Multi-Process Model

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Main Process  │◄───►│  Preload Script │◄───►│ Renderer Process│
│    (main.js)    │ IPC │  (preload.js)   │ API │ (renderer.js)   │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   LCU API       │     │ Live Client API │ (in-game detection)
│ (HTTPS + Auth)  │     │ 127.0.0.1:2999  │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────────────┐
│  Data Dragon    │     │     CommunityDragon     │ (skin rarity)
│   API (HTTPS)   │     │  (raw.communitydragon)  │
└─────────────────┘     └─────────────────────────┘
```

### Data Flow

1. **Detection**: Main process searches for League Client via lockfile or process inspection
2. **Authentication**: Extracts credentials (port, password) from lockfile or command line
3. **Fetch Summoner**: Calls `/lol-summoner/v1/current-summoner` for user info
4. **Fetch Skins**: Calls `/lol-champions/v1/inventories/{id}/skins-minimal` for all skins
5. **Fetch Mastery**: Calls `/lol-collections/v1/inventories/{id}/champion-mastery` for sort data
6. **Fetch Chromas**: Per-champion batch calls to get chroma ownership data
7. **Enrichment**: Maps skin IDs to champions using Data Dragon, fetches rarity from CommunityDragon
8. **Cache**: Stores processed data locally for offline access
9. **Display**: Renderer shows skins in a filterable, groupable grid with splash art

### Live Game Detection
- Polls Live Client Data API (`127.0.0.1:2999`) during games for active champion
- Falls back to LCU champ-select endpoint for pre-game detection
- Auto-scrolls UI to detected champion's skin group

---

## Build and Run Commands

### Prerequisites
- **Windows 10/11** (required for League Client integration)
- **Node.js** ≥ 18
- **npm**
- **League of Legends client** installed and logged in (for live data)

### Install Dependencies
```bash
npm install
```

### Run Application
```bash
npm start
```
Starts the Electron application.

### Code Quality Commands
```bash
# Run ESLint
npm run lint

# Format code with Prettier
npm run format

# Check formatting without writing
npm run format:check
```

---

## Code Style Guidelines

### JavaScript Conventions
- **Main/Preload**: Use **CommonJS** (`require`/`module.exports`)
- **Renderer**: Use **ES6+ features** (arrow functions, const/let, template literals)
- **Semicolons**: Required (ESLint rule)
- **Quotes**: Single quotes preferred (ESLint/Prettier)
- **Variables**: Use `const`/`let`, never `var` (ESLint rule: `no-var: error`)
- **Arrow functions**: Avoid parentheses when single parameter (Prettier: `arrowParens: avoid`)
- **Comments**: Use `// ═══ SECTION NAME ═══` format for major sections
- **Console logs**: Prefix with `[LCU]`, `[CDragon]`, or `[Game]` for context

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `skinData`, `championMap` |
| Constants | UPPER_SNAKE_CASE (arrays/maps) | `RARITY_ORDER`, `BORDER_MAP` |
| Functions | camelCase, action names | `fetchSkinsData`, `buildChampionSidebar` |
| CSS Classes | kebab-case, BEM-like | `.skin-card-overlay`, `.gem-item` |
| File names | kebab-case | `styles.css`, `preload.js` |

### CSS Conventions
- CSS custom properties (variables) defined in `:root`
- Color scheme: dark backgrounds (`--bg-deep: #080c14`) with gold accents (`--gold: #c89b3c`)
- Font pairing: `Cinzel` (decorative headers) + `Inter` (UI text)
- Transition timing: `var(--ease)` = `0.2s cubic-bezier(0.4, 0, 0.2, 1)`
- Rarity colors: `--r-mythic`, `--r-ultimate`, `--r-legendary`, `--r-epic`, `--r-standard`, `--r-transcendent`, `--r-exalted`

### Prettier Configuration
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "tabWidth": 2,
  "arrowParens": "avoid"
}
```

### ESLint Key Rules
- `semi: error` — Semicolons required
- `quotes: warn, single` — Single quotes preferred
- `no-var: error` — Use const/let only
- `prefer-const: warn` — Prefer const when not reassigned
- `eqeqeq: warn` — Use === and !==
- `no-console: off` — Console logs allowed

---

## LCU Integration Details

### Lockfile Detection Strategy
The app tries multiple methods to find the League Client (in order):

1. **Cached path** — Checks previously saved lockfile location
2. **Drive scan** — Scans drives C-Z for common installation paths:
   - `Riot Games\League of Legends`
   - `Games\Riot Games\League of Legends`
   - `Program Files\Riot Games\League of Legends`
   - `Program Files (x86)\Riot Games\League of Legends`
3. **PowerShell Get-Process** — Gets executable path from running process
4. **Get-CimInstance** — Parses command line for `--app-port` and `--remoting-auth-token`

### LCU API Authentication
- Username: `riot`
- Password: From lockfile or command line `--remoting-auth-token`
- Uses HTTPS with self-signed certificate (`rejectUnauthorized: false`)

### Key Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/lol-summoner/v1/current-summoner` | Current user info |
| `/lol-champions/v1/inventories/{summonerId}/skins-minimal` | All skins with ownership flags |
| `/lol-collections/v1/inventories/{summonerId}/champion-mastery` | Champion mastery levels |
| `/lol-champions/v1/inventories/{summonerId}/champions/{champId}/skins` | Skin details including chromas |
| `/lol-champ-select/v1/current-champion` | Currently selected champion |

### Data Dragon Endpoints
- Versions: `https://ddragon.leagueoflegends.com/api/versions.json`
- Champion data: `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json`
- Splash art: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{champion}_{skinNum}.jpg`
- Tile art: `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/{champion}_{skinNum}.jpg`
- Profile icons: `https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{id}.png`

### CommunityDragon Endpoints
- Skin rarity: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json`

---

## Security Considerations

1. **Context Isolation**: Enabled (`contextIsolation: true`) — preload is the only bridge
2. **Node Integration**: Disabled in renderer (`nodeIntegration: false`)
3. **Sandbox**: Enabled (`sandbox: true`)
4. **HTTPS Rejection Override**: Required for LCU self-signed certificates (`rejectUnauthorized: false`)
5. **Content Security Policy**: Strict CSP headers set in main.js and meta tag
6. **Local-only APIs**: LCU API only accessible via localhost
7. **HTML Sanitization**: `sanitize()` function in main.js for user-facing strings

---

## Testing

This project does not have automated test suites. Testing is manual:

1. Ensure League Client is running and you are logged in
2. Run `npm start`
3. Verify:
   - Loading overlay appears while connecting
   - Summoner info displays in titlebar with avatar
   - Skin grid populates with both owned and unowned skins
   - Rarity gems display correctly on owned skins
   - Chroma badges appear on skins with chromas
   - Search filters skins by name/champion
   - Group by Champion/Tier/All works correctly
   - Sort by Mastery/Most Owned/Most Complete/Alphabetical works
   - Toggle unowned visibility works
   - Modal opens on skin click showing splash art
   - Error overlay appears if League Client is not running (with cached data fallback)
   - Live game detection works (enter champ select or game)
   - System tray menu works (if icon.ico exists)

---

## Data Persistence

### Local Storage Locations
Uses Electron's `app.getPath('userData')` for JSON file storage:
- `preferences.json` — User preferences (window bounds, groupBy, sortBy, showUnowned)
- `skinCache.json` — Cached skin data for offline viewing

### Data Structure (skin cache)
```javascript
{
  summoner: { displayName, summonerId, summonerLevel, profileIconId, profileIconUrl },
  skins: [ /* enriched skin objects */ ],
  stats: { total, totalAll, byRarity: {...}, legacy, totalChromas, ownedChromas },
  version: "14.x.x",
  fetchedAt: timestamp
}
```

---

## External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| electron | ^33.3.1 | Desktop app framework |
| eslint | ^8.57.0 | Code linting (dev) |
| prettier | ^3.2.0 | Code formatting (dev) |

Note: No runtime dependencies — uses only Node.js built-in modules (`https`, `fs`, `path`, `child_process`).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "League Client Not Found" error | Ensure League Client is running and user is logged in |
| Empty skin list | Verify you are logged into the League Client |
| Slow loading | Check internet connection for Data Dragon API access |
| Window controls not working | Check preload script loaded correctly |
| No chroma data | Champion chroma endpoint may have changed — check console |
| Tray icon missing | Ensure `icon.ico` exists in project root |

---

## Development Notes for AI Agents

- This is a **Windows-only** application due to PowerShell/WMI dependencies
- The app requires the **League Client to be running** for live data — it falls back to cached data if unavailable
- Skin data is cached to disk; use refresh button to clear cache and fetch fresh data
- Data Dragon version is cached until app restart or refresh
- The live game poller runs every 5 seconds when the app is open
- All LCU API calls use the native `https` module with custom auth headers
- Rarity detection prioritizes CommunityDragon data, then LCU gem paths, then LCU rarity enum, then name heuristics
