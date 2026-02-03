

# Background Animation & Performance Optimization

## Overview
Update the blurred blob background to match the provided HTML code exactly, including colors, animation style, and speeds. Also optimize for better performance.

---

## Changes Summary

### 1. Update BlurredBlobBackground.tsx - Complete Rewrite

Replace the current rect-based gradient implementation with path-based blobs matching the reference:

**New Colors (from reference)**:
- Purple: `#9b5de5`
- Pink: `#f15bb5`  
- Blue: `#00bbf9`
- Cyan: `#00f5d4`

**Key Changes**:
- Use `<path>` elements instead of `<rect>` elements for organic blob shapes
- Add SVG glow filter (`<feGaussianBlur>` + `<feColorMatrix>`) for the glow effect
- Use `viewBox="10 10 80 80"` instead of `0 0 100 100`
- Remove the 200% sizing (major performance improvement)
- Use standard 100% width/height for the SVG

**Animation Speeds** (matching reference):
- out-top: 20s
- in-top: 10s
- out-bottom: 25s
- in-bottom: 15s

**Blur Layer**: Reduce from 100px to 60px, saturation from 150% to 140%

**Vignette**: Match reference values (0% at 30%, 60% at 65%, 95% at 100%)

---

### 2. Update index.css - Restore Animation Speeds

Update the blob animation speeds to match the reference:

```text
.blob-out-top    → 20s (was 40s)
.blob-in-top     → 10s (was 30s)
.blob-out-bottom → 25s (was 50s)
.blob-in-bottom  → 15s (was 35s)
```

---

## Performance Improvements

| Issue | Fix |
|-------|-----|
| SVG 200% oversized | Use 100% width/height |
| 100px blur (expensive) | Reduce to 60px |
| rect gradients with animate | Use path shapes (simpler) |
| Multiple backdrop-filter layers | Optimized single layer |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/BlurredBlobBackground.tsx` | Complete rewrite with path-based blobs, glow filter, exact colors |
| `src/index.css` | Update animation speeds to match reference (20s, 10s, 25s, 15s) |

---

## Technical Details

### New SVG Structure
```text
<svg viewBox="10 10 80 80">
  <defs>
    <filter id="glow">  ← Gaussian blur + color matrix for glow
    </filter>
  </defs>
  
  <path class="out-top" fill="#9b5de5" filter="url(#glow)" d="..."/>
  <path class="in-top" fill="#f15bb5" filter="url(#glow)" d="..."/>
  <path class="out-bottom" fill="#00bbf9" filter="url(#glow)" d="..."/>
  <path class="in-bottom" fill="#00f5d4" filter="url(#glow)" d="..."/>
</svg>
```

### Layer Structure (unchanged)
```text
z-0: SVG blobs (fixed, 100% viewport)
z-1: Blur layer (backdrop-filter: blur(60px))
z-2: Vignette (radial-gradient fade to black)
z-3+: Content (navbar, notes, forms)
```

