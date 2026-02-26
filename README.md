# LoL Skin Viewer

A desktop application that displays your complete League of Legends skin collection — owned and unowned — styled to match the in-game client.

![Electron](https://img.shields.io/badge/Electron-33-blue?logo=electron)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Full Skin Collection** — View every skin for every champion, with owned skins highlighted and unowned skins shown darkened with a lock icon.
- **Stats Dashboard** — Total skins owned, breakdown by rarity tier (Mythic, Ultimate, Legendary, Epic, Standard), and chroma count.
- **Chroma Badges** — See how many chromas you own per skin, displayed as a rainbow badge on each card.
- **Group & Sort** — Group skins by Champion or Tier. Sort by Mastery, Most Owned, Most Complete %, or Alphabetically.
- **Live Game Integration** — Automatically detects when you're in champ select or in-game and navigates to that champion's skins.
- **Offline Mode** — Caches data locally so you can browse your collection even when the League client isn't running.
- **Auto-Detection** — Finds the League client installation automatically across all drives.

## Screenshots

> Launch the app with the League client running to see your collection.

## Requirements

- **Windows 10/11**
- **Node.js** ≥ 18
- **League of Legends** client installed (for live data)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/your-username/LOL_skin_viewer.git
cd LOL_skin_viewer

# Install dependencies
npm install

# Run the app
npm start
```

The app will automatically find your League client. If it can't connect, it will show cached data or prompt you to open the client.

## How It Works

1. **LCU API** — Reads the League client's `lockfile` to get local API credentials, then fetches your summoner info, skin inventory, champion mastery, and chroma ownership.
2. **Data Dragon** — Pulls champion metadata and splash art from Riot's CDN.
3. **Live Client Data API** — Polls `127.0.0.1:2999` during games to detect your active champion.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Launch the Electron app |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## Project Structure

```
LOL_skin_viewer/
├── main.js          # Electron main process (LCU, caching, IPC, game poller)
├── preload.js       # Secure IPC bridge
├── renderer.js      # UI logic (filtering, grouping, rendering)
├── index.html       # App layout
├── styles.css       # LoL client-inspired dark theme
├── package.json
├── .eslintrc.json
└── .prettierrc
```

## Privacy

This app only communicates with:
- **localhost** — League client API (`127.0.0.1`)
- **Riot CDN** — `ddragon.leagueoflegends.com` (public, no auth)

No data is sent to any external server. All cached data is stored locally in your system's app data directory.

## License

MIT
