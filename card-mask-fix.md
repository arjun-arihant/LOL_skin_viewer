# PLAN: Skin Card Mask Fix

## Overview
The user is trying to apply `.png` masks (`card-mask.png` and `card-mask-transcendent.png`) to `.skin-card-img` to crop the corners that bleed out of the custom League of Legends borders. However, it's not working as expected. This is likely due to either relative pathing issues from the CSS file (`css/` -> `../assets/`) or mismatched aspect ratios (the border is 264x382, while the image container is 260x381, causing a 100% stretch mask to misalign with the border cutouts).

## Project Type
WEB

## Success Criteria
- The skin card image correctly uses `assets/borders/card-mask.png` (and transcendent respective variants).
- The image corners no longer stick out past the decorative borders.
- The mask aligns perfectly with both the `standard` and `transcendent` borders.

## Tech Stack
- CSS3 (`mask-image`, `-webkit-mask-image`, `mask-size`, `mask-position`)

## File Structure
- `css/skin-card.css` (Target for modifications)

## Task Breakdown

### 1. Fix Image Mask CSS Configuration
- **Agent:** `frontend-specialist`
- **Skills:** `clean-code`, `frontend-design`
- **INPUT:** `css/skin-card.css`
- **OUTPUT:** Updated `.skin-card-img` and `.skin-card.transcendent .skin-card-img` CSS rules.
- **VERIFY:** Ensure `url('../assets/borders/card-mask.png')` is used (correct relative pathing).
- **VERIFY:** If masks share the exact dimensions of the border overlay (e.g., 264x382), ensure `mask-size` and `mask-position` correspond to the border's offsets (`width: calc(264/260 * 100%)`, `left: calc(-2/260 * 100%)`, etc.) to prevent squashing and misalignment. Alternatively, if `clip-path` is chosen, implement the polygon values perfectly.

## Phase X: Verification (CHECKLIST)
- [ ] Lint: ✅ Run `npm run lint` or visually inspect the CSS to ensure no syntax errors.
- [ ] Security: ✅ N/A (CSS only)
- [ ] Build/UI: Verify UI locally. No corners must stick out of the skin frames.
- [ ] Rule Compliance: ✅ Socratic principles adhered to, no strict UI library overrode the design.
