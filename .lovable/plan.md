
# Blurred Blob Background Implementation

## Overview
Add an animated, blurred blob background effect to the NotaForge website. The effect consists of:
- Animated SVG blobs with rotating gradient shapes
- A heavy blur layer using backdrop-filter
- A black vignette/fade effect around the edges

This creates a subtle, dynamic background while keeping the pure black and white theme intact.

---

## Implementation Approach

### 1. Create a Background Component
Create a new reusable component `BlurredBlobBackground.tsx` that contains:
- The animated SVG with rotating gradient blobs
- The blur layer overlay
- The vignette/fade effect

This component will be positioned as a fixed background layer behind all content.

### 2. Update NotaForgeDashboard
Integrate the background component into the main dashboard, ensuring:
- The background stays fixed behind all scrollable content
- All existing UI elements remain on top with proper z-indexing
- Performance is optimized (animations use CSS transforms for GPU acceleration)

---

## Visual Effect Breakdown

```text
Layer Structure (bottom to top):
┌─────────────────────────────────────┐
│ SVG Blobs (z-index: 0)              │  ← Animated rotating gradients
├─────────────────────────────────────┤
│ Blur Layer (z-index: 1)             │  ← backdrop-filter: blur(60px)
├─────────────────────────────────────┤
│ Vignette Fade (z-index: 2)          │  ← Radial gradient fade to black
├─────────────────────────────────────┤
│ Content (z-index: 3+)               │  ← Header, notes, forms
└─────────────────────────────────────┘
```

---

## Technical Details

### New File: `src/components/BlurredBlobBackground.tsx`
- SVG element with animated gradient blobs using CSS keyframe animations
- Four rotating blob shapes at different speeds (10s, 15s, 20s, 25s)
- White/gray gradients that blend subtly with the black background
- Blur overlay with `backdrop-filter: blur(60px) saturate(140%)`
- Vignette using radial-gradient that fades to black at edges

### Modifications to: `src/components/NotaForgeDashboard.tsx`
- Import and add `BlurredBlobBackground` component at the start of the return
- Ensure the main container and all content have appropriate z-index values
- The header (currently z-50) will remain above all background layers

### CSS Additions to: `src/index.css`
- Add keyframe animation for smooth blob rotation
- Ensure backdrop-filter compatibility with vendor prefixes

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/BlurredBlobBackground.tsx` | Create new component |
| `src/components/NotaForgeDashboard.tsx` | Add background component |
| `src/index.css` | Add blob rotation animation keyframes |

---

## Animation Details

The blobs will rotate continuously at different speeds to create organic, flowing movement:
- **out-top blob**: 20s rotation cycle
- **in-top blob**: 10s rotation cycle  
- **out-bottom blob**: 25s rotation cycle
- **in-bottom blob**: 15s rotation cycle

All animations use `linear infinite` timing for smooth, continuous motion.
