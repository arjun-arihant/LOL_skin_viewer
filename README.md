# LoL Skin Viewer

A sleek, elegant desktop application built with Electron that displays your complete League of Legends skin collection (both owned and unowned) utilizing a native client-inspired dark theme.

![Electron](https://img.shields.io/badge/Electron-33-blue?logo=electron)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Full Collection View** — Browse every skin for every champion. Owned skins are vibrantly displayed, while unowned skins are styled with a dimmed lock icon overlay.
- **Stats Dashboard** — View your total owned skins and breakdown metrics by rarity tier (Transcendent, Exalted, Ultimate, Mythic, Legendary, Epic, Standard), alongside legacy counts and total chromas.
- **Visual Rarity & Chromas** — Each owned skin features its explicit CDragon-sourced rarity gem, CDragon border overlay, and a chroma count badge.
- **Smart Grouping & Sorting** — Keep organized by grouping skins organically (by Champion, Tier, or All). Sort by Mastery points, Alphabetical order, or Most Owned.
- **Instant Client Detection** — The app automatically scans your drives and processes to seamlessly detect your running League of Legends client and extract necessary API credentials.

## Quick Start
Get up and running in under a minute.

**Requirements:**
- Windows 10/11
- Node.js ≥ 18
- League of Legends client (Running and logged in)

```bash
# Clone the repo
git clone https://github.com/your-username/LOL_skin_viewer.git
cd LOL_skin_viewer

# Install dependencies
npm install

# Run the app locally (Make sure the League Client is open!)
npm start
```

## How It Works

1. **LCU API (League Client Update)**: The application utilizes intelligent PowerShell and WMI scripts to find your League `lockfile` across all drives. It then utilizes the extracted credentials to authenticate against the local LCU API to fetch user inventory and mastery data.
2. **Data Dragon (DDragon)**: Pulls static champion metadata, tile splash arts, and profile images directly from Riot's global CDN.
3. **CommunityDragon (CDragon)**: Authoritative source for skin rarity classifications, mapping unstandardized internal Riot variables into visually recognizable gems.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Launch the Electron application |
| `npm run lint` | Run ESLint rules against the codebase |
| `npm run format` | Format code beautifully with Prettier |

## Project Structure

A clean, modular layout ensuring maintainability and separation of concerns:

```
LOL_skin_viewer/
├── main.js          # Electron main process (LCU discovery, IPC API, data aggregation)
├── preload.js       # Secure context bridge API
├── renderer.js      # Frontend logic (Filtering, rendering, dropdowns, DOM)
├── index.html       # Primary layout
├── css/             # Modular CSS structure
│   ├── variables.css      # Core tokens
│   ├── layout.css         # App layout boundaries
│   ├── titlebar.css       # Native-like header
│   ├── sidebar.css        # Control dashboard
│   ├── skin-card.css      # Splashes, borders, overlays
│   └── ...           
├── assets/          # Static CDragon overlays
└── AGENTS.md        # Technical architecture documentation for AI agents
```

## Privacy & Security

This app runs locally on your machine. It only interfaces with:
- **localhost (`127.0.0.1`)**: Authorized League Client API
- **Riot Games CDN**: Public image assets

Zero personal data is sent to external or third-party servers. All parsed collections are safely cached locally within your user's AppData directory for fast offline access.

## License

MIT License.
