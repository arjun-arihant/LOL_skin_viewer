# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Launch the Electron app (requires League client running)
npm run dev        # Launch with --dev flag for development
npm run build      # Build Windows portable executable to dist/
npx eslint .       # Lint (no npm script defined despite README claiming one)
npx prettier . --write  # Format code
```

> Note: `npm run lint` and `npm run format` are documented in README but are **not defined** in package.json. Use `npx` to invoke them directly.

## Architecture

RiftVault is a Windows-only Electron app with three processes:

**[main.js](main.js)** — Main process (Node.js / CommonJS)
- Discovers the League client lockfile via 4-tier fallback: drive scan → PowerShell Get-Process → PowerShell WMI → legacy `wmic`
- Makes all LCU HTTPS calls (Basic auth, `rejectUnauthorized: false` for localhost only)
- Aggregates skin data from three sources: LCU API, Data Dragon (DDragon), CommunityDragon (CDragon — `skins.json` + `skinlines.json`)
- Handles all `ipcMain` handlers: `get-skins`, `get-cached-skins`, `refresh-skins`, `get-skin-prices`, `select-skin`
- Polls for champion select state and emits `live-game-event` to the renderer; auto-surfaces the window on the lock-in edge
- Owns a `Tray` icon: closing the window hides to tray (intercepted via `mainWindow.on('close')`); `before-quit` destroys the tray and sets the `isQuitting` flag
- BrowserWindow is created with `webviewTag: true` to enable the renderer's in-app browser tabs

**[preload.js](preload.js)** — Context bridge
- Exposes `window.riftVaultAPI` to the renderer via `contextBridge`
- `contextIsolation: true` is strictly enforced and must never be disabled

**[renderer.js](renderer.js)** — Renderer process (ES6+ / no bundler)
- All DOM manipulation, filter/sort/group logic, modal state, audio effects
- Calls `window.riftVaultAPI` (never `ipcRenderer` directly)
- State is stored in module-level variables; filter/sort preferences + the wishlist (`localStorage` key `wishlist`) persist across sessions
- `TabManager` owns the in-app tab bar: a permanent Collection tab, an optional Wishlist tab, and dynamic `<webview>` tabs for Wiki / 3D model / Skin Spotlight links (max 8, oldest non-pinned evicted)
- Sort dropdown is dynamic: `SORT_OPTIONS` + `rebuildSortMenu()` rebuild it when `groupBy` changes; `all` and `tier` modes lock the dropdown

**[css/](css/)** — Modular stylesheets, one file per concern. `variables.css` is the source of truth for all design tokens (gold `#c89b3c`, cyan `#0ac8b9`, card ratio 260×381px). `tabs.css` covers the tab bar + webview panes.

## Key Data Flow

1. LCU lockfile → port + Basic auth token
2. `/lol-summoner/v1/current-summoner` → summoner ID
3. `/lol-champions/v1/inventories/{id}/skins-minimal` → full skin inventory
4. Mastery (3-tier fallback): `/lol-champion-mastery/v1/local-player/champion-mastery` → puuid endpoint → legacy summonerId endpoint
5. `/lol-champions/v1/inventories/{id}/champions/{champId}/skins` fetched in **chunks of 15** to avoid LCU rate limiting → chroma ownership arrays
6. DDragon `loadingUrl` slices (not `/tiles/`) for vertical card framing
7. CDragon `/v1/skins.json` → authoritative rarity map, `isLegacy` flag, **and `skinLines` per skin** (cached)
8. CDragon `/v1/skinlines.json` → skin-line id → display name map, used by the "Set" group mode

Champion ID is derived mathematically: `champId = Math.floor(skin.id / 1000)`

## Rarity Detection

4-tier fallback: CDragon rarity map → gemPath string → rarity enum → heuristics. The CDragon source is authoritative; never assume LCU alone has correct rarity data. `isLegacy` and `skinLines` are likewise sourced from CDragon and override the corresponding LCU fields when present.

## Code Conventions

- **main.js / preload.js**: CommonJS (`require`)
- **renderer.js**: ES6+ (arrow functions, template literals, no bundler)
- **CSS**: BEM-adjacent kebab-case; single responsibility per file; never add rules to `variables.css` without a design token rationale
- `const` over `let`; `var` is forbidden; semicolons required; single quotes

## Caching

Skin data is cached to `app.getPath('userData')/skin-cache.json` for offline browsing. The cache is read via `get-cached-skins` IPC and written after a successful `buildOwnedSkins()` call.

## Security Notes

- `rejectUnauthorized: false` is intentional and scoped only to LCU localhost calls — do not remove
- All external CDN image requests (`img src`) must point to CDragon/DDragon global nodes, not through the local LCU server, due to Chrome's SSL enforcement
- Unowned skin dimming is handled via CSS classes, not JS conditional rendering
