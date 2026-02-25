# LoL Skin Viewer - Agent Documentation

## Project Overview

**LoL Skin Viewer** is an Electron-based desktop application for Windows that displays a League of Legends player's owned skin collection. It connects to the local League Client (LCU API) to retrieve skin data and enriches it with champion information and artwork from Riot's Data Dragon API.

### Key Features
- Automatically detects the running League Client using multiple strategies
- Displays owned skins with splash art and rarity classification
- Search and filter skins by champion
- Custom frameless window with dark theme (LoL-inspired gold accents)
- Modal view for detailed skin inspection

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Electron v29.0.0 |
| Main Process | Node.js (CommonJS) |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Styling | Custom CSS with CSS variables |
| HTTP Client | Node.js native `https` module |
| External APIs | Riot LCU API, Data Dragon API |

---

## Project Structure

```
LOL_skin_viewer/
├── main.js           # Electron main process - LCU API communication, window management
├── preload.js        # Secure context bridge between main and renderer
├── renderer.js       # Frontend logic - UI rendering, search, filtering
├── index.html        # Main application UI markup
├── styles.css        # Application styling with dark theme
├── package.json      # Dependencies and scripts
└── .gitignore        # Git ignore rules
```

### File Responsibilities

| File | Purpose |
|------|---------|
| `main.js` | Window creation, LCU lockfile detection, API calls to League Client, Data Dragon integration |
| `preload.js` | Exposes secure API (`window.lolAPI`) to renderer for IPC communication |
| `renderer.js` | DOM manipulation, event handling, skin grid rendering, modal management |
| `index.html` | Application layout with custom titlebar, sidebar, skin grid |
| `styles.css` | Dark theme styling with gold accent variables, animations, responsive grid |

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
┌─────────────────┐
│   LCU API       │ (Local League Client on 127.0.0.1)
│ (HTTPS + Auth)  │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Data Dragon    │ (Riot's CDN for champions/skins data)
│   API (HTTPS)   │
└─────────────────┘
```

### Data Flow

1. **Detection**: Main process searches for League Client via lockfile or process inspection
2. **Authentication**: Extracts credentials (port, password) from lockfile or command line
3. **Fetch**: Calls LCU API endpoints (`/lol-summoner/v1/current-summoner`, `/lol-champions/v1/inventories/{id}/skins-minimal`)
4. **Enrichment**: Maps skin IDs to champions using Data Dragon API
5. **Display**: Renderer shows skins in a filterable grid with splash art

---

## Build and Run Commands

### Prerequisites
- Node.js (LTS recommended)
- npm
- Windows OS (required for League Client integration)
- League of Legends client must be running and user logged in

### Install Dependencies
```bash
npm install
```

### Run in Development Mode
```bash
npm run dev
```
Starts the app with `--dev` flag for debugging.

### Run Production Build
```bash
npm start
```
Starts the Electron application.

---

## Code Style Guidelines

### JavaScript Conventions
- Use **CommonJS** (`require`/`module.exports`) for Node.js files
- Use **ES6+ features** in renderer (arrow functions, const/let, template literals)
- Comments use `// ─── SECTION NAME ───` format for major sections
- Prefix console logs with `[LCU]` for LCU-related operations

### Naming Conventions
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for config arrays
- Functions: `camelCase`, descriptive action names (`fetchSkinsData`, `buildChampionSidebar`)
- CSS Classes: `kebab-case` with BEM-like naming (`.skin-card-overlay`)

### CSS Conventions
- CSS custom properties (variables) defined in `:root`
- Color scheme: dark backgrounds (`--bg-deep: #07090f`) with gold accents (`--gold: #c89b3c`)
- Font pairing: `Cinzel` (decorative headers) + `Inter` (UI text)
- Transition timing: `--transition: 0.22s cubic-bezier(0.4, 0, 0.2, 1)`

---

## LCU Integration Details

### Lockfile Detection Strategy
The app tries multiple methods to find the League Client:

1. **Lockfile paths**: Checks common installation directories across drives C-G
2. **PowerShell Get-Process**: Gets executable path from running process
3. **PowerShell WMI**: Parses command line arguments for `--app-port` and `--remoting-auth-token`
4. **Legacy wmic**: Fallback to wmic command for older Windows versions

### LCU API Authentication
- Username: `riot`
- Password: From lockfile or command line `--remoting-auth-token`
- Uses HTTPS with self-signed certificate (`rejectUnauthorized: false`)

### Key Endpoints
- `GET /lol-summoner/v1/current-summoner` - Current user info
- `GET /lol-champions/v1/inventories/{summonerId}/skins-minimal` - Owned skins

---

## Security Considerations

1. **Context Isolation**: Enabled (`contextIsolation: true`) - preload is the only bridge
2. **Node Integration**: Disabled in renderer (`nodeIntegration: false`)
3. **HTTPS Rejection Override**: Required for LCU self-signed certificates
4. **Local-only API**: LCU API only accessible via localhost

---

## Testing

This project does not have automated test suites. Testing is manual:

1. Ensure League Client is running and you are logged in
2. Run `npm run dev`
3. Verify:
   - Loading overlay appears while connecting
   - Summoner info displays in titlebar
   - Skin grid populates with owned skins
   - Search and champion filtering work
   - Modal opens on skin click
   - Error overlay appears if League Client is not running

---

## Deployment

No build/packaging scripts are configured. To distribute:

1. Install dependencies: `npm install`
2. Package with Electron Builder or Electron Forge (not currently configured)
3. Distribute the packaged application to Windows users

---

## External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| electron | ^29.0.0 | Desktop app framework |
| node-fetch | ^2.7.0 | HTTP requests (Note: Currently unused - native https used instead) |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "League Client Not Found" error | Ensure League Client is running and user is logged in |
| Empty skin list | Verify you are logged into the League Client |
| Slow loading | Check internet connection for Data Dragon API access |
| Window controls not working | Check preload script loaded correctly |

---

## Notes for AI Agents

- This is a **Windows-only** application due to PowerShell/WMI dependencies
- The app requires the **League Client to be running** - it cannot function standalone
- Skin data is cached in memory; use refresh button to clear cache
- Data Dragon version is cached until app restart or refresh
- No persistence layer - all data is fetched fresh on each launch
