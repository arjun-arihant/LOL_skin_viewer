# Changelog

All notable changes to this project will be documented in this file.

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