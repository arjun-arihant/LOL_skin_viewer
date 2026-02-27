# 🗺️ PLAN-image-clipping

## 1. Context & Objective
The champion skin images are extending outside the newly framed 260x381 pixel boundaries, specifically at the corners (which have circular arcs/chamfers) and the top-center (which has a notch). The goal is to visually mask the `.skin-card-img` so that it completely hides any parts of the image that fall outside the true transparent window of the border.

## 2. Options (Socratic Gate)
1. **CSS `clip-path: polygon(...)`**: Hardcoded coordinate cuts for the corners and notch.
2. **SVG `mask-image`**: A precise vector mask matching the 264x382 internal frame.
3. **PNG Alpha Mask (`mask-image`)**: A raster mask extracted from the original border PNGs.

*Waiting for User to confirm the preferred approach based on the brainstorm.*

## 3. Implementation Steps (Once chosen)
- [ ] **Step 1:** Generate or calculate the masking asset (SVG path, Polygon coords, or PNG mask).
- [ ] **Step 2:** Apply the mask to `.skin-card-img` in `d:\repos\LOL_skin_viewer\css\skin-card.css`.
  - For `mask-image`: `mask-image: url('...'); mask-size: 100% 100%;`
  - For `clip-path`: `clip-path: polygon(...);`
- [ ] **Step 3:** Handle webkit prefixes (`-webkit-mask-image`, `-webkit-clip-path`) for cross-browser compatibility.
- [ ] **Step 4:** Verify that the image no longer spills into the dark/golden regions of the border.

## 4. Verification Checklist
- [ ] Verify corner arcs are cleanly clipped.
- [ ] Verify the top notch correctly cuts into the top-center of the image.
- [ ] Run rendering tests to ensure the GPU composite performance remains high when scrolling the skin grid.
