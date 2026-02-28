# LoL Skin Viewer - Agent Documentation

## Project Overview

**LoL Skin Viewer** is an Electron-based desktop application for Windows that displays a League of Legends player's complete skin collection. It aggregates data securely from the local League Client (LCU API), Riot's Data Dragon, and CommunityDragon, outputting an ultra-premium, native-feeling User Interface modeled directly after League's aesthetic.

### Key Capabilities
- **Complete Collection View** — Displays both owned and unowned skins. Accurate card topologies ensure perfectly aligned borders and rarity gems.
- **Intelligent Rarity Detection** — Fetches from CDragon as a primary source of truth, gracefully falling back to LCU internal gem paths and variables.
- **Stats Dashboard** — Granular metrics reporting legacy metrics, total owned count, and rarity categorization.
- **Auto-Detection** — Aggressively scours all common Windows directories via native PowerShell/WMI calls to securely parse the League `lockfile`.
- **Modular Design architecture** — Separated logic into Main, Preload, Renderer, and multiple CSS structural files.
- **State Persistence & QoL** — Checkboxes and sorting/grouping dropdowns persist across sessions using `localStorage`.
- **Responsive Layout & Packaging** — Dynamic window sizing based on screen dimensions, sticky flexbox layouts, and GitHub Actions integration for automated portable Executable builds using `electron-builder`.
- **Deep External Integrations** — Features context-aware deep links for exact Champion Fandom Wikis and Khada 3D Model viewer links built dynamically from skin IDs.

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Electron | ^33.3.1 |
| Main Process | Node.js (CommonJS) | - |
| Frontend | Vanilla HTML5, CSS3, JS (ES6+) | - |
| Styling | Modular CSS architecture | - |
| HTTP Client | Node.js native `https` module | - |
| External APIs | Riot LCU API, Data Dragon, CommunityDragon | - |

---

## Architecture & Project Structure

The project has recently undergone an architectural shift to prioritize frontend maintainability.

```
LOL_skin_viewer/
├── main.js              # Electron main process - LCU API communication, multi-drive discovery
├── preload.js           # Secure context bridge (`window.lolAPI`)
├── renderer.js          # DOM manipulation, filter engine, modal state management
├── index.html           # Core DOM markup
├── css/                 # Modern, modular CSS system
│   ├── variables.css      # CSS Tokens, Roots, variables
│   ├── layout.css         # Structural boundaries
│   ├── titlebar.css       # Draggable header
│   ├── sidebar.css        # Control dashboard and metrics
│   ├── main-content.css   # Skin grid container
│   ├── skin-card.css      # Absolute positioning for splash arts, borders, and tier gems
│   ├── overlays.css       # Modals, Loading rings, Error states
│   └── animations.css     # CSS Keyframes
├── assets/              # Static frontend assets (icons, borders)
└── refactor-css.md      # Documentation of CSS segregation logic
```

### Electron Multi-Process Model

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Main Process  │◄───►│  Preload Script │◄───►│ Renderer Process│
│    (main.js)    │ IPC │  (preload.js)   │ API │ (renderer.js)   │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   LCU API       │
│ (HTTPS + Auth)  │
└─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────────────┐
│  Data Dragon    │     │     CommunityDragon     │
│   API (HTTPS)   │     │  (raw.communitydragon)  │
└─────────────────┘     └─────────────────────────┘
```

---

## Code Quality & Conventions

### JS Guidelines
- **Main/Preload**: CommonJS (`require`).
- **Renderer**: ES6+ (arrow functions, template literals).
- **Semis/Quotes**: Required semicolons, preference for single quotes string syntax.
- **Variables**: `const` over `let`. `var` is strictly disallowed.

### CSS Methodology
We have abandoned the monolithic `styles.css`. 
- Always enforce **Single Responsibility Principle** within the `/css/` folder.
- CSS classes follow a BEM-adjacent pattern using kebab-case. 
- Absolute structural fidelity to the 260x381 League Skin Card ratio within `skin-card.css`.
- Golden Accents (`#c89b3c`) and Blue accents (`#0ac8b9`) are strictly maintained via root tokens in `variables.css`.

---

## LCU Integration Strategy

### Multi-Faceted Lockfile Discovery
The app requires the League client to be running properly and utilizes a 4-tier strategy:

1. **Standard Drive Scan** — Scans `C:`, `D:`, `E:`, `F:`, `G:` against common Riot directories.
2. **PowerShell Get-Process** — Infers the process path passively.
3. **PowerShell WMI Execution** — Extracts exactly the `--app-port` and `--remoting-auth-token` from the active command line parameters passed directly into `LeagueClientUx.exe`.
4. **Legacy WMIC** — Command-prompt fallback for older implementations.

### Internal API Call Flow
1. Find Lockfile -> Execute Token Authentication via Basic Auth.
2. Hit `/lol-summoner/v1/current-summoner` (Summoner identification).
3. Hit `/lol-champions/v1/inventories/{id}/skins-minimal` (Master inventory array).
4. Hit `/lol-collections/v1/inventories/{id}/champion-mastery` (Data needed for sorting algorithms).
5. Hit `/lol-champions/v1/inventories/{id}/champions/{champId}/skins` dynamically in chunks of 15 to map individual Chroma arrays without triggering the LCU backend Rate Limiter.
6. Map raw IDs mathematically (ex: `champId = Math.floor(skin.id / 1000)`) against fetched DDragon arrays, assigning DDragon's official `/loadingUrl/` slices instead of `/tiles/` to generate seamless vertical card framing.

---

## Testing & Security Requirements

1. **Security Constraints**: 
   - `contextIsolation: true` is strictly enforced.
   - `rejectUnauthorized: false` remains mandatory only for internal localhost LCU calls due to Riot's self-signed certificating.
   - External CDN requests remain completely sandboxed. (e.g. Chrome SSL `-202` strict enforcement mandates all `img src` calls bypass local LCU servers and hit CDragon global nodes instead).
2. **QA Checkpoints**:
   - Ensure the app falls back elegantly when DDragon or CDragon APIs expire (via `.catch{}`).
   - Verify unowned items correctly dim and overlay via CSS logic instead of JS logic.
   - Inspect chroma counts mathematically rendering on top of the `.chroma-badge`, ensuring they only sum items strictly tagged with `c.ownership.owned === true`.
