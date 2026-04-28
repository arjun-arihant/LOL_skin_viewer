# Changelog

All notable changes to this project will be documented in this file.

---

## [0.3.0] - 2026-04-29

### Added
- **Wishlist**: Click the heart on any unowned skin to save it to your personal wishlist. A dedicated Wishlist tab gives you a clean view of every skin you're chasing, complete with a live count. Wishlists persist locally and auto-prune entries the moment a skin becomes owned.
- **In-App Browser Tabs**: External links no longer kick you out to your default browser. The Champion Wiki, Khada 3D Model Viewer, and the new Skin Spotlight link all open as tabs *inside* RiftVault, with a tab bar across the top of the window (up to 8 simultaneous tabs).
- **Skin Spotlight Link**: A third link in the skin detail modal that opens a YouTube `@SkinSpotlights` search for the skin in an in-app tab.
- **Group by Set**: A new grouping mode that organizes your collection by skin line / universe (Star Guardian, PROJECT, K/DA, etc.). Skin-line names are sourced from CommunityDragon's `skinlines.json`. An "Other" bucket catches uncategorized skins and is always pinned to the bottom.
- **Most Complete % Sort**: A new sort option that orders groups by ownership percentage — perfect for finding sets you're one or two skins away from completing. Available in `Champion` and `Set` modes.
- **Collection RP Value**: A new mini-stat in the sidebar that sums the RP cost of every owned non-base skin, with an estimated USD equivalent.
- **System Tray**: Closing the window now hides RiftVault to the system tray instead of quitting. Right-click the tray icon to re-open or quit. A one-time balloon notification explains this on first close.
- **Auto-Surface on Lock-In**: RiftVault now unhides and focuses itself the moment you lock in a champion during champion select, so the Apply controls are right there waiting.

### Changed
- **Mastery Endpoint Hardening**: Mastery data is now fetched with a 3-tier fallback (`/lol-champion-mastery/v1/local-player/...` → puuid endpoint → legacy summonerId endpoint) to keep the Mastery sort working as Riot iterates on the LCU.
- **Skin-Line Authority**: Skin-line metadata and the `isLegacy` flag are now sourced from CommunityDragon rather than the LCU. This fixes a class of mis-grouped or mis-tagged skins.
- **Titlebar Refactor**: The Refresh button moved out of the old top bar and now lives in the titlebar alongside a new Wishlist toggle. The standalone "ALL SKINS" header was removed in favor of the cleaner tabbed layout.
- **Locked Sort Modes**: When grouping by `All` or `Tier`, the Sort dropdown is now greyed out and locked to the only meaningful order, removing a small UI footgun.

### Improved
- **Within-Group Mastery Sort**: When sorting by Mastery, individual skins inside a champion group are now also ordered by mastery points (owned first, then by mastery descending).
- **Completed-Group Styling**: Group headers display with a subtle highlight when you've collected every skin in the group.
- **Parallel CDragon Fetches**: `skins.json` and `skinlines.json` are now fetched in parallel during inventory build for a small startup speedup.

---

## [0.2.0] - 2026-03-03

### Added
- **Apply Skin In-Client**: A highly requested feature! You can now apply any owned skin directly from RiftVault to your League of Legends client.
  - Contextual golden "Apply in Client" button appears on skin cards and inside the detailed modal.
  - Buttons only activate *after* you have securely locked in your champion during champion select.
  - Real-time polling instantly tracks which skin is currently equipped, updating the UI with a green "Applied ✓" checkmark automatically, even if changed from within the League client itself.

### Changed
- **Massive Rebrand**: The project has officially been renamed from *LoL Skin Viewer* to **RiftVault**.
  - Updated all internal links, GitHub references, and the primary application title.
  - The portable executable output is now named `RiftVault.x.x.x.exe`.
- Optimized the main application window default layout, adjusting the optimal start dimensions and reducing the minimum height/width boundaries to better accommodate smaller screens. 

### Improved
- Cleaned up the IPC bridge, transitioning from `window.lolAPI` to `window.riftVaultAPI` for long-term maintainability.
- Full `README.md` revamp including new feature documentation, architecture breakdowns, and updated installation instructions.

---

## [0.1.0] - 2026-02-28

### Added
- Initial public release of the desktop application.
- Complete skin collection viewer interfacing cleanly with local LCU and Riot Data Dragon.
- Intelligent tier & rarity detection using CommunityDragon parameters.
- Comprehensive UI stats dashboard and interactive Chroma galleries.