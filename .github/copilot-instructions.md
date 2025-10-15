# GitHub Copilot Instructions

## Project Overview

This is a high-performance, single-page portfolio website combining **Three.js 3D rendering** with **custom smooth scroll** and **GSAP animations**. The project showcases a 3D head model with advanced lighting, scroll-reactive postprocessing effects (reeded glass), and a custom cursor system.

### Technology Stack

- **Build System**: Parcel 2.x bundler (dev server on port 3000)
- **3D Engine**: Three.js 0.130.0 (orthographic camera, GLTF models, HDR lighting)
- **Postprocessing**: postprocessing 6.29.3 (bloom, reeded glass, grain, vignette)
- **Animation**: GSAP 3.13.0 (startup sequences, scroll-based animations)
- **Smooth Scroll**: Custom Lenis-inspired implementation (disabled on touch devices)
- **Typography**: Troika Three Text 0.52.4 (3D text rendering)

### Key Commands

```bash
npm run start     # Dev server (macOS/Linux)
npm run devmac    # Dev server (macOS)
npm run build     # Production build to dist/
```

---

## Architecture

### 1. Core Module Structure

The codebase follows a **modular ES6 architecture** with separation of concerns:

```
src/
├── main.js                 # Three.js scene setup, lighting, GLTF loading, postprocessing
├── index.js                # Navigation logic (navbar, side dots, scroll-based states)
├── smoothScroll.js         # Custom smooth scroll with ScrollTrigger integration
├── cursor.js               # Custom cursor with hover states and click-to-scroll
├── textReveal.js           # GSAP ScrollTrigger text animations
├── gridToggle.js           # Design grid overlay toggle
├── contactCopy.js          # Contact form clipboard functionality
├── gsapButtonFlair.js      # Button hover animations
├── stickyColumn.js         # Sticky column scroll behavior
├── buttonHover.js          # Button interaction states
├── effects/
│   └── OverlayEffects.js  # Custom postprocessing effects (reeded glass, grain, vignette)
└── styles.css              # Design system with CSS variables and responsive styles
```

**Critical Module Loading Order** (in `index.htm`):
1. `smoothScroll.js` (must initialize first for ScrollTrigger proxy)
2. `cursor.js` (depends on smoothScroll for position tracking)
3. `index.js` (navbar logic depends on smoothScroll position)
4. All other feature modules (order independent)
5. `main.js` (Three.js scene initialization last, uses smoothScroll.scrollCurrent)

### 2. Three.js Scene Architecture

#### Camera System
- **Type**: `THREE.OrthographicCamera` with dynamic frustum sizing
- **Frustum Control**: `frustumSize` (zoom) and `frustumHeight` (vertical position)
- **Responsive**: `updateOrthoFrustum()` adjusts camera based on aspect ratio and device type
  - Portrait phones: zoom out more (`frustumSize * 1.5`), nudge up (`heightOffset - 6.5`)
  - Tablets: slight zoom out (`frustumSize * 1.4`)
  - Landscape: default frustum settings

#### Scene Positioning
- **Default**: `scene.position.x = 0.35` (nudge right to correct off-center model)
- **Section 6 Effect**: Scene moves right by 10 units while model rotates -18° (facing left) for contact section

#### Lighting Strategy
- **Hemisphere Light**: Warm blue sky (`#abd5f7`) at intensity 40
- **Key Light**: Warm red point light from below/front center (`#E60E00`, intensity 3000)
- **Accent Spotlights**:
  - Red under-hair spotlight (intensity 3500, angled up toward hairline)
  - Red front-right spotlight (intensity 1000, narrow beam)
  - Red upper-right spotlight (very narrow, intensity 1200)
  - Red left-side spotlight (intensity 100)
  - Cool blue top-down spotlight (`#75B3CA`, intensity 150)
  - Neutral gray spotlights (top-left and overhead)
- **Startup Sequence**: All lights start at 10% intensity, ramp to 100% when eyes turn on

#### Material System
- **Face**: Metalness 0.99, Roughness 0.38, shadow mask texture (darkens recessed areas)
- **Sweater**: Metalness 0, Roughness 1, black override material for `sweater_black` nodes
- **Hair**: Metalness 1, Roughness 0.7
- **Eyes**: Bloom-enabled emissive material (`#0053ED`, intensity 3-6 based on scroll)

#### GLTF Model Loading
1. Load `head_packed.glb` via `GLTFLoader` with Meshopt compression
2. Extract bones: `Chin`, `Neck`, `Head`, `Left_shoulder`, `Right_shoulder`
3. Play `Wind` animation clip via `THREE.AnimationMixer`
4. Apply material configs and shadow mask texture
5. Set max anisotropy on all textures for crispness

#### HDRI Environment
- Load `hdri_bg.hdr` via `RGBELoader`
- Rotate HDR sphere -90° for proper orientation
- Generate environment map via `PMREMGenerator`
- Scene uses both `scene.environment` and `scene.background`

### 3. Scroll-Based Effects System

The entire experience is driven by **scroll progress** (0-1 normalized across 6 sections):

#### Progress Calculation
```javascript
// Section 1→2 transition: 0 to 1/3
// Section 2→3 transition: 1/3 to 2/3
// Section 3→4 transition: 2/3 to 1.0 (only last 100vh of section 3)
// Sections 4-6: maintain 1.0
currentScrollProgress = Math.min(scrollY / (sectionHeight * (totalSections - 1)), 1.0);
```

#### Reeded Glass Effect (`OverlayEffects.js`)
- **Section 1**: No effect
- **Section 2→3**: Left half gets glass effect (0-100% opacity)
- **Section 3→4**: Right half gets glass effect (0-100% opacity) while left maintains full
- **Section 5→6**: Glass fades out over 1.8 viewports **before** model moves

**Integration Points**:
```javascript
setReededScrollProgress(_reedEffect, effectProgress);
setReededSplitScreenMode(_reedEffect, splitScreen, boundary, rightSideProgress);
```

#### Other Scroll Animations
- **Wind Speed**: Reduces to 50% in sections 2-3 (`mixer.timeScale = WIND_BASE_TS * 0.5`)
- **Eye Intensity**: Reduces by 30% in final section
- **Head Movement**: Restricted to 16% of normal range during sections 2-3
- **Gradient Colors**: Top color transitions from `#1C214B` to `#0C0F21` (darker blue)
- **Exposure**: Remains constant at `1.0` throughout (was previously variable)

### 4. Postprocessing Pipeline

Render passes applied in order:

1. **RenderPass**: Base scene render
2. **EffectPass**: Bloom (selective, eyes only), Hue/Saturation, Brightness/Contrast, SMAA
3. **BottomVignettePass**: Screen fade at bottom (vignette effect)
4. **ReededPass**: Refractive glass shader (depth-aware, split-screen capable)
5. **GrainPass**: Film grain overlay (reduced opacity on phones)

#### Adaptive Performance System
- **Device Profiles**: Auto-detected (phone, tablet, fanless Mac, desktop)
- **DPR Buckets**: `[1.0, 0.9, 0.8]` multiplied by `baseCapCurrent`
- **Effect Quality Tiers**: `[ultra, high, med, low]` (internal resolution scaling)
- **Adaptive Logic**:
  - EMA smoothing (~1s window) of frame time
  - Degrade if FPS < 55 for 4s sustained
  - Upgrade if FPS ≥ 65 for 6s sustained
  - Prefer DPR changes over effect tier changes
- **Resume Guards**: Prevents downscales for 4.5s after `visibilitychange`/`focus`/`pageshow`

### 5. Smooth Scroll System

#### Implementation (`smoothScroll.js`)
- **Fixed Body**: `position: fixed; overflow: hidden` on `<body>`
- **Transform Content**: `#content` div translated via `translate3d(0, -Ypx, 0)`
- **Damped Following**: `scrollTarget` tracks user input, `scrollCurrent` lerps toward it with `ease: 0.18`
- **ScrollTrigger Integration**: `scrollerProxy` updates GSAP's scroll position from `scrollCurrent`
- **Touch Device Handling**: Disables smooth scroll on touch devices, falls back to native scroll

#### Exposure to Other Modules
```javascript
window.smoothScroll = smoothScroll;
window.smoothScroll.scrollCurrent // Current smooth scroll position
window.smoothScroll.scrollTo(target, duration) // Programmatic scrolling
```

### 6. Custom Cursor System

#### States
- **Default**: White dot (14px) with subtle shadow
- **Hover Clickable**: Scales up (1.3×), fades to 40% opacity
- **Scroll Mode**: Shows chevron below dot (rotates based on scroll direction)
  - Points down (0°) in bottom 75% of viewport
  - Points up (180°) in top 25% OR in last section (contact)
- **Click States**:
  - `custom-cursor--active`: Normal click on interactive elements
  - `custom-cursor--scroll-click`: Click-to-scroll action (black dot)

#### Chevron Behavior
- **Lag Effect**: Position lerps toward mouse with `lagFactor: 0.25`
- **Transform Origin**: Set to cursor dot position (`50% -1.8em`)
- **Hidden States**: Text field focus, hovering clickable elements
- **Rotation**: Smooth interpolation to 0° or 180° with cubic easing

#### Click-to-Scroll
- Detects non-clickable area clicks
- Scrolls to next/previous section based on chevron direction
- Uses `smoothScroll.scrollTo()` with 1200ms duration

### 7. Startup Sequence

**5-Phase GSAP Timeline** (total ~3.5s):

1. **Phase 1 (0-0.6s)**: Fade from loading overlay, reveal canvas and dark background
2. **Phase 2 (0.62s)**: Set low exposure (0.14) and dim eyes (intensity 0.5, color black)
3. **Phase 3 (1.62s)**: Eyes turn on (intensity 6, color `#2C2C2C`), lights ramp 10%→100%
4. **Phase 4 (2.42s)**: Exposure ramps to 1.0, background opacity to 0.75
5. **Phase 5 (2.52s)**: Chin settles to rest position, camera zoom-out (1.06→1.0)

**Post-Startup** (+0.1s):
- Enable head look on non-touch devices (`startHeadLook(chin)`)
- Enable breathing (`allowBreathing = true`)
- Touch devices: run breathing-only loop (no head follow)

### 8. Navigation System

#### Bottom Navbar
- **Primary State**: No background (home section only)
- **Secondary State**: Dark background with backdrop blur (sections 2-6)
- **Logo**: Clickable, scrolls to top

#### Side Dots Navigation
- 4 dots mapped to sections: `home`, `about` (sections 2-3), `work`, `contact`
- Synced with scroll position via `updateNavbarOnScroll()`

#### Dark Overlay
- Fades in for sections 4-6 (and section 3 on mobile ≤1024px)
- Fully black in section 5 (work cards)
- Controlled by `#dark-overlay` div with `.is-visible` and `.is-fully-black` classes

---

## Design System

### CSS Architecture

#### Design Tokens (`:root` variables)
```css
/* Colors */
--primary-brand: #E60E00;        /* Red accent */
--primary-cta: #0053ED;          /* Blue CTA */
--text-primary: #E8EFFF;         /* Light blue-white */
--text-secondary: #919FAF;       /* Muted blue-gray */
--text-accent: #C7D0DE;          /* Mid blue-gray */
--bg-primary: #010101;           /* Near black */
--bg-secondary: #101010;         /* Dark gray */

/* Typography Scale */
--font-serif: 'Fraunces', serif;     /* Italic headings */
--font-sans: 'Antonio', sans-serif;  /* Uppercase headings */
--font-body: 'Outfit', sans-serif;   /* Body text */

--text-xs: clamp(0.875rem, 0.8rem + 0.125vw, 1rem);
--text-sm: clamp(1rem, 0.9rem + 0.25vw, 1.25rem);
--text-base: clamp(1.125rem, 1rem + 0.375vw, 1.5rem);
--text-lg: clamp(1.25rem, 1.1rem + 0.5vw, 1.75rem);
--text-xl: clamp(1.5rem, 1.3rem + 0.625vw, 2.125rem);
/* ... continues up to --text-8xl */

/* Spacing */
--space-xs: clamp(0.5rem, 0.4rem + 0.125vw, 0.625rem);
--space-sm: clamp(1rem, 0.9rem + 0.25vw, 1.25rem);
/* ... continues up to --space-3xl */
```

#### Grid System
- **12-column grid** with `0.5em` gutters
- `.grid` container with `.col-N` classes (N = 1-12)
- Responsive breakpoints: 420px, 600px, 768px, 1024px, 1200px, 1440px, 1920px
- **Design Grid Overlay**: Toggle with `Cmd/Ctrl + G` (`.design-grid` element)

#### Media Queries
- **Organization**: All consolidated at end of `styles.css`
- **Order**: Feature queries → max-width (descending) → min-width (ascending) → range queries
- **Breakpoints**: 420, 600, 768, 1024, 1200, 1280, 1440, 1700, 1850, 1920, 2000px

### Responsive Patterns

#### Portrait Phone Adjustments
- Canvas height: `vh * 1.15` (oversize to cover viewport resizes)
- Bottom cover plane: Feathered black plane to hide seam at bottom
- Reeded glass: Reduced opacity, wider flute width

#### Touch Device Behavior
- Smooth scroll disabled (uses native `overflow: auto`)
- Head look disabled (breathing-only mode)
- Lighter SMAA preset (prefer DPR over heavy AA)
- Grain effect reduced to 4% opacity

---

## Critical Workflows

### Adding New Scroll-Based Effects

1. **Update `handleScroll()` in `main.js`**:
   ```javascript
   const scrollProgress = Math.min(scrollY / (sectionHeight * (totalSections - 1)), 1.0);
   // Add your effect interpolation
   const effectValue = Math.lerp(startValue, endValue, scrollProgress);
   ```

2. **Sync with startup sequence**:
   ```javascript
   // In initializeScrollEffectsFromCurrentPosition()
   // Apply initial values based on currentScrollProgress
   ```

3. **Ensure ScrollTrigger compatibility**: Use `smoothScroll.scrollCurrent` not `window.scrollY`

### Modifying Postprocessing Effects

1. **Effect Module** (`effects/OverlayEffects.js`):
   ```javascript
   export const myEffectParams = { /* uniforms */ };
   export function createMyEffectPass(camera) {
     const effect = new MyCustomEffect(/* ... */);
     const pass = new EffectPass(camera, effect);
     return { effect, pass };
   }
   ```

2. **Main Integration** (`main.js`):
   ```javascript
   import { createMyEffectPass } from './effects/OverlayEffects.js';
   const { effect: myEffect, pass: myPass } = createMyEffectPass(camera);
   composer.addPass(myPass); // Order matters!
   ```

3. **Update on Resize**: Add to `handleResize()` if effect needs resolution updates

### 3D Asset Pipeline

**Fusion 360 → Blender → GLTF → Three.js**

1. **Fusion 360**: Model design, export as OBJ/FBX
2. **Blender**:
   - Import model
   - Rig with armature (bones: Chin, Neck, Head, shoulders)
   - Create `Wind` animation clip
   - Apply materials (Face, Hair, Sweater)
   - Bake shadow mask texture (`Head_Shadowmask.png`)
   - Export as GLTF with Draco/Meshopt compression
3. **Compression** (optional): `gltfpack --tc --tq 10 input.glb -o output.glb`
4. **Three.js**:
   - Place in `src/assets/`
   - Update `modelUrl` import in `main.js`
   - Adjust material configs in `manipulateModel()`

---

## Common Pitfalls & Solutions

### 1. Scroll Position Mismatch
**Problem**: Effects use `window.scrollY` instead of smooth scroll position.
**Solution**: Always use `smoothScroll.scrollCurrent` or wrap with:
```javascript
const getScrollPosition = () => window.smoothScroll?.scrollCurrent ?? window.scrollY;
```

### 2. Media Query Specificity Conflicts
**Problem**: Conflicting styles when mixing max-width and min-width queries.
**Solution**: All media queries are at end of `styles.css` in organized order. Add new queries to appropriate section (max-width descending or min-width ascending).

### 3. Three.js Performance on Mobile
**Problem**: Heavy scene causes dropped frames on phones.
**Solution**: Adaptive DPR system auto-handles this. For manual tuning:
```javascript
window.__perfDebug.forceBucket(2); // Drop to 0.8 DPR bucket
window.__perfDebug.forceTier(1);   // Reduce effect quality to 'high'
```

### 4. Loading Overlay Stuck
**Problem**: Assets fail to load, overlay never fades.
**Solution**: Check `loadingManager.onError` console warnings. Verify asset paths in imports.

### 5. Head Look Not Working
**Problem**: Chin bone rotation not responding to mouse.
**Solution**:
- Ensure `allowHeadLook = true` after startup
- Check `IS_TOUCH_DEVICE` flag (head look disabled on touch)
- Verify chin bone reference: `chin = o.isBone && o.name === 'Chin'`

### 6. Reeded Glass Not Showing
**Problem**: Glass effect invisible or improperly positioned.
**Solution**:
- Check `reededParams.enabled = true`
- Verify scroll progress: `console.log(currentScrollProgress)`
- Ensure depth pass renders: `animate._depthRT` should exist
- Confirm split-screen mode: `window.reededParams.splitScreenMode`

### 7. Custom Cursor Misaligned
**Problem**: Cursor dot or chevron offset from mouse position.
**Solution**:
- Check CSS: `custom-cursor` should have `position: fixed; pointer-events: none;`
- Verify transform: `translate(${mouseX}px, ${mouseY}px)`
- Chevron origin: `transformOrigin = '50% -1.8em'`

---

## Testing Checklist

### Cross-Device Testing
- [ ] Desktop (Chrome, Firefox, Safari)
- [ ] Tablet (iPad, Android tablet) - portrait and landscape
- [ ] Phone (iPhone, Android) - portrait and landscape
- [ ] Touch device: smooth scroll disabled, breathing-only mode
- [ ] Retina displays: DPR scaling works correctly

### Performance Validation
- [ ] 60fps sustained on desktop at default quality
- [ ] Adaptive system degrades gracefully on lower-end devices
- [ ] No layout shifts during adaptive DPR changes
- [ ] Resume guard prevents unnecessary downscales after tab switch

### Scroll Effects
- [ ] Reeded glass appears in sections 2-3 (left side)
- [ ] Reeded glass appears in sections 3-4 (right side)
- [ ] Glass removes before model moves in section 6
- [ ] Wind animation slows in sections 2-3
- [ ] Eye intensity reduces in final section
- [ ] Head movement restricted during glass sections

### Navigation
- [ ] Bottom navbar: Primary state in section 1, Secondary in 2-6
- [ ] Side dots: Active states match current section
- [ ] Dark overlay: Visible in sections 4-6, fully black in section 5
- [ ] Logo click scrolls to top
- [ ] Anchor links work with smooth scroll

### Startup Sequence
- [ ] Loading overlay fades in on page load
- [ ] Progress bar animates during asset loading
- [ ] Scene fades in after assets ready
- [ ] Eyes turn on at correct timing (1.62s)
- [ ] Lights ramp from 10% to 100%
- [ ] Chin settles to rest position smoothly
- [ ] Camera zoom-out syncs with chin movement

---

## Debugging Utilities

### Performance HUD
```javascript
window.__perfDebug // Auto-updates with current FPS, DPR bucket, effect tier
```
Click/tap the HUD to expand and see performance change log.

### Reeded Glass Tweaks
```javascript
window.reededParams.refractPx = 15;  // Increase refraction strength
window.reededParams.fluteWidthDesktop = 1.0; // Wider vertical bands
window.updateReeded({ refractPx: 15 }); // Live update
```

### Scroll Controls
```javascript
window.setScrollRefractionMultiplier(4.0); // Stronger glass refraction
window.setHeadMovementRestriction(0.5);    // 50% head movement when scrolling
```

### Camera/Scene Controls
```javascript
frustumSize = 28; // Zoom in (smaller = more zoom)
frustumHeight = 2; // Move scene down
handleResize();   // Apply changes
```

### Bottom Cover Plane
```javascript
window.setBottomCoverFeather(0.4); // Adjust feather blur (0-0.6)
```

---

## Deployment Notes

### Build Process
```bash
npm run build  # Outputs to dist/
```
- Parcel bundles all modules
- Assets copied from `src/assets/` and `public/`
- `--public-url ./` ensures relative paths work on any host

### Asset Optimization
- **GLTF Models**: Use Meshopt compression, keep under 5MB
- **HDRI**: Compress with HDRIHaven tools, 2K resolution max
- **Textures**: WebP format for photos, PNG for UI graphics
- **SVG Icons**: Inline small icons, external for larger logos

### Performance Budget
- **Initial Load**: < 3s on 3G (including loading overlay fade)
- **First Contentful Paint**: < 1.5s
- **Startup Sequence**: 3.5s total (blocking for visual experience)
- **Framerate**: Maintain 60fps on mid-tier devices (iPhone 12, M1 MacBook Air)

---

## Style Conventions

### JavaScript
- **ES6 Modules**: Use `import`/`export`, avoid global pollution except intentional `window.*` APIs
- **Naming**: `camelCase` for functions/variables, `PascalCase` for classes, `SCREAMING_SNAKE_CASE` for constants
- **Async/Await**: Prefer over promise chains for readability
- **Comments**: Document "why" not "what" (code should be self-explanatory)

### CSS
- **BEM-like Naming**: `.block__element--modifier` pattern
- **Mobile-First**: Base styles for mobile, enhance with min-width media queries
- **Design Tokens**: Always use CSS variables for colors, spacing, typography
- **No Inline Styles**: Except for dynamic JS-driven transforms/positions

### Three.js
- **Dispose Properly**: Call `.dispose()` on geometries, materials, textures when removing
- **Reuse Materials**: Create once, apply to multiple meshes
- **Logarithmic Depth**: Not used (orthographic camera, limited depth range)

---

## Project-Specific Gotchas

### 1. Scene Position Offset
The entire scene has `scene.position.x = 0.35` to correct model centering. When adding new objects, account for this offset or add them as children of the scene to inherit the transform.

### 2. Startup State Variables
Global flags control post-startup behavior:
- `startupActive`: Blocks certain animations during startup
- `allowHeadLook`: Gates head-follow logic (false during startup and on touch)
- `allowBreathing`: Gates breathing animations (false until startup completes)

### 3. Scroll Progress Normalization
`currentScrollProgress` is always 0-1 across the first 4 sections, then held at 1.0 for sections 5-6. Effects that need section-specific logic should check `currentSection` (0-5) instead.

### 4. Touch Device Detection
Uses multiple heuristics:
```javascript
const IS_TOUCH_DEVICE = (
  matchMedia('(pointer:coarse)').matches ||
  'ontouchstart' in window ||
  /mobi|iphone|ipad|android|tablet/.test(navigator.userAgent)
);
```

### 5. Visual Viewport vs Window
Code uses `window.visualViewport` when available (better on mobile), fallback to `window.innerWidth/Height`. Resize events listen to both.

### 6. GSAP ScrollTrigger Scroller
Always set `scroller: '#content'` or use `ScrollTrigger.defaults({ scroller })` since smooth scroll moves the content div, not the window.

### 7. Postprocessing Pass Order
Order is critical:
1. Scene render (with depth pass)
2. Color grading + bloom
3. Vignette (before glass so it doesn't get refracted)
4. Reeded glass
5. Grain (overlays everything)

### 8. Reeded Glass Depth Mask
Requires custom depth pass (`animate._depthRT`) to separate foreground (head) from background (gradient plane). Without depth texture, glass refracts everything including UI elements.

---

## Future Enhancements

### Potential Improvements
- [ ] **Lazy Load Sections**: Only initialize 3D scene when section 1 enters viewport
- [ ] **WASM Postprocessing**: Move complex shaders to WebAssembly for mobile performance
- [ ] **Preload Hints**: Add `<link rel="preload">` for GLTF and HDR assets
- [ ] **Service Worker**: Cache assets for offline access
- [ ] **Analytics**: Track scroll depth, section engagement, performance metrics
- [ ] **A11y Enhancements**: Add ARIA live regions for scroll-based state changes
- [ ] **Fallback Content**: Provide static image fallback if WebGL unavailable

### Known Limitations
- **Safari Touch Scroll**: Smooth scroll disabled on touch devices, uses native scroll (intentional for performance)
- **Low-End Phones**: May drop to 30fps with full effects (adaptive system helps but not perfect)
- **Long Sections**: Section 3 is intentionally tall to allow smooth glass transition
- **No IE11 Support**: Requires modern ES6+ browser (Chrome 90+, Firefox 88+, Safari 14+)

---

## Contact & Support

For questions about this architecture or to report issues with AI-generated code:
1. Check this document first for common patterns
2. Review `main.js` for Three.js integration points
3. Review `index.js` for navigation logic
4. Review `smoothScroll.js` for scroll system
5. Consult Three.js docs: https://threejs.org/docs/
6. Consult GSAP docs: https://greensock.com/docs/

---

**Last Updated**: 2025-01-09  
**Maintained By**: Project Author  
**AI Assistant**: Use this document as authoritative source for architectural decisions and implementation patterns.
