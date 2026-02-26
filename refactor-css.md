# CSS Refactoring Plan

## Goal
Break down the monolithic `styles.css` into smaller, logically separated files stored in the `css/` directory.

## Load Order & File Structure
The CSS files will be loaded directly in `index.html` via `<link>` tags to allow parallel downloading. The load order is crucial because some files rely on variables and foundational resets.

1.  **`css/variables.css`**: CSS variables (colors, sizing, shadows), basic reset, and scrollbar styling.
2.  **`css/layout.css`**: High-level app layout structure (`.app-layout`).
3.  **`css/titlebar.css`**: Custom titlebar styling.
4.  **`css/sidebar.css`**: Left control panel, stats ring, rarity gems, controls, and dropdowns.
5.  **`css/main-content.css`**: Top bar, section titles, and high-level skin grid layout.
6.  **`css/skin-card.css`**: Individual skin card styling, hover effects, rare gems on cards, locks, and chromas.
7.  **`css/overlays.css`**: Empty states, loading overlays, error overlays, and modal box styles.
8.  **`css/animations.css`**: All `@keyframes` declarations.

## Asset Path Adjustments
Moving the CSS context into the `css/` directory requires updating relative URLs for background images. 
- `url('assets/...')` will be updated to `url('../assets/...')` in the new CSS files.

## Actions to perform
1. Create the 8 files in `css/`.
2. Update `index.html` to remove `styles.css` and use 8 `<link rel="stylesheet">` tags.
3. Validate that the application retains identical visuals.
