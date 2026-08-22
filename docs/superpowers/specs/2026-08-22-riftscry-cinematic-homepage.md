# RiftScry Cinematic Homepage Refactor

**Date:** 2026-08-22  
**Status:** Direction locked, implementation authorized by the brief  
**Surface:** `/` only  
**Mode:** Persuade / Experience  
**Dials:** `DESIGN_VARIANCE 10 / MOTION_INTENSITY 9 / VISUAL_DENSITY 4`

## Direction contract

**THESIS**  
RiftScry turns an overwhelming patch into one continuous, traceable line of change. The homepage refuses the category-default hero-and-feature-stack and behaves as a single transforming archive.

**OWN WORLD**  
Warm ink, cream enamel, restrained brushed gold, sharp matte planes, colossal patch numerals, real champion crops, and one uninterrupted gold rift ribbon. No visual box resets the canvas.

**STORY**  
Something changed. The visitor crosses the RiftScry mark, watches patch noise resolve around their champion pool, sees exact before/after values become history and comparison, then reaches inspectable source data and acts.

**FIRST VIEWPORT**  
Minimal navigation at the top edge. A physical RiftScry monogram dominates the right half. `26.16` and “Something changed.” counterweight it on the left. The gold slash already points through the monogram’s negative space toward the next world.

**FORM**  
An axial enfilade of live DOM scenes organized by one delta ribbon. Scene containers overlap and hand matter forward; GSAP controls camera-like transforms while normal document scroll remains sovereign.

## Incumbent audit

### What is already good and must survive

- Real build-time patch data drives every number, label, role count, history entry, and source fragment.
- The `26.x` patch identity is distinctive and should remain the dominant numeric language.
- Warm ink, cream, and gold are derived from the supplied logo and already avoid generic blue-black gaming UI.
- Clash Display, General Sans, and Spline Sans Mono provide clear expressive, information, and numeric modes.
- The logo assets are high-resolution transparent PNGs with a recognizable cream-and-gold monogram.
- Astro static output, React islands, Data Dragon assets, localStorage pool personalization, and route structure are healthy.
- GSAP and ScrollTrigger are already installed and kept out of product-state logic.
- Reduced motion, keyboard navigation, visible focus, semantic headings, and CVD-safe change labels already have test coverage.

### What currently makes the homepage feel like a page

- Eight components each declare their own rectangular section, bottom border, max-width container, and large symmetric padding.
- Every scene establishes a new layout instead of inheriting geometry or material from the previous one.
- The logo is only a 20-28px header asset; it never becomes a story object.
- The hero’s patch number animates, but the animation resolves inside the hero and hands nothing onward.
- Pins exist scene-by-scene, producing a sequence of demonstrations rather than camera travel through one world.
- The champion moment is a grid of square portraits, which reads as a product block rather than editorial imagery.
- The role scene is a conventional bordered list.
- The open-source scene flips to a boxed panel and code card, breaking the environmental language.
- The close is a centered CTA block followed by a separate footer rather than a visual resolution.
- The vertical “Scroll” cue, repeated borders, and generic section headings create familiar landing-page rhythm.
- Mobile is mainly the desktop layout stacked and de-pinned rather than an authored alternate cut.

### Baseline

- `npm test`: 16 files, 135 tests passing.
- `npm run build`: 452 static pages built successfully.
- Dependencies already include GSAP 3.15; Three.js/WebGL is unnecessary for the selected direction.

## Three concepts

### 1. The Delta Loom

- **Visual metaphor:** The gold rift slash is a scrying needle pulling a single ribbon of change through every patch state.
- **Opening scene:** The monogram is a cream-enamel object sharing the viewport with a monumental `26.16` and the sentence “Something changed.”
- **Logo interaction:** The slash separates from the mark as a depth layer; the camera follows it through the R’s upper negative space.
- **Environmental language:** Thin matte patch planes, woven data strips, portrait apertures, and gold rails. No literal loom machine.
- **Transitions:** The slash becomes a data strip; surviving strips become champion apertures; an aperture flattens into a delta; the delta arrow becomes a history rail; role rails become code indentation; code reconstructs the mark.
- **Typography:** Clash Display for brief spatial statements, Spline Sans Mono for patch coordinates and deltas, General Sans for product explanation.
- **Product UI:** Real patch rows materialize from the environmental strips rather than appearing as a screenshot.
- **Final scene:** Source lines and role rails converge into the compact monogram beside the final two actions.
- **Mobile:** One dominant ribbon, fewer depth planes, one portrait at a time, short CSS-sticky threshold instead of long pins.
- **Technical approach:** DOM, existing PNG logo, SVG/CSS masks, CSS perspective, GSAP ScrollTrigger. No WebGL.

### 2. The Palimpsest Foundry

- **Visual metaphor:** Every patch is a new engraved proof pressed over the previous state.
- **Opening scene:** `26.15` is physically sheared by a gold rule and stamped into `26.16` beside a monumental press-like monogram.
- **Logo interaction:** The monogram’s diagonal stroke acts as the cutting and registration edge; its negative space becomes the press bed.
- **Environmental language:** Lacquered plates, registration marks used only when functional, embossed numerals, scraped old values, and clean proof sheets.
- **Transitions:** Notes compress into a plate; a champion portrait is printed from it; old values peel off; plates stack into history; overlapping proofs become comparison.
- **Typography:** Wide display numerals and restrained proofreader notation; information remains clean grotesk/mono.
- **Product UI:** The approved proof rotates flat and becomes the live patch page component.
- **Final scene:** The last proof is signed by its source URL and slides back into the monogram.
- **Mobile:** A vertical sequence of plates with one shear transition and no deep perspective.
- **Technical approach:** DOM layers, clip-path shears, blend-free shadows, GSAP transforms. High feasibility, but repeated plate edges risk reintroducing sections.

### 3. The Rift Aperture

- **Visual metaphor:** RiftScry is a precision aperture that aligns noisy historical layers until one exact change becomes legible.
- **Opening scene:** The monogram is an optical instrument viewed obliquely; `26.14`, `26.15`, and `26.16` are misaligned behind it.
- **Logo interaction:** Scrolling aligns the mark’s internal openings, then the visitor passes through the resolved aperture.
- **Environmental language:** Concentric masks, depth-calibration planes, crop frames, thin focal rails, and overlapping typographic states.
- **Transitions:** Misaligned notes resolve to pool portraits; focus depth separates before/after; the focal rail becomes history; role paths become viewing angles.
- **Typography:** Large patch numbers as depth markers, short display statements, quiet information labels.
- **Product UI:** The final aligned layer is the real patch component, already in focus.
- **Final scene:** The aperture closes around the current patch and returns to navigation scale.
- **Mobile:** One aperture with two aligned layers; lateral comparison becomes vertical displacement.
- **Technical approach:** SVG masks, CSS perspective, clip-path, GSAP. Best mobile simplicity, but less uniquely tied to the logo’s gold slash.

## Evaluation

Scores are out of 10.

| Concept | Originality | Brand fit | Cinematic | Clarity | Feasibility | Mobile | Performance | Anti-generic | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| The Delta Loom | 9 | 10 | 10 | 9 | 9 | 8 | 9 | 9 | **73** |
| The Palimpsest Foundry | 9 | 9 | 9 | 8 | 8 | 7 | 8 | 9 | 67 |
| The Rift Aperture | 8 | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 70 |

**Selected: The Delta Loom.** It is the only direction in which one existing brand element can causally become every later structure. It also reaches the requested “inside the logo” moment without WebGL and can collapse to one readable ribbon on mobile.

## Visual reference analysis

The image-first pass produced three opening compositions and four continuation studies. They are north stars, not raster assets.

### What carries forward

- Option C’s diagonal slash spanning the viewport, with the next patch state already visible through an aperture.
- Option A’s sense that the monogram is a physical threshold large enough to cross.
- Option B’s separated logo depth layers and quieter matte plane environment.
- The signal study’s deep field of note strips narrowing into four relevant champion paths.
- The delta study’s single dominant value, old state on a receding plane, new state occupying the camera plane, and history rail already visible.
- The history study’s patch numbers placed at real depth along one rail, comparison planes crossing that rail, and role paths growing from it.
- The source study’s code indentation guides as a continuation of the role paths, ending in a reconstructed brand mark.

### What must not be literalized

- No gothic columns, temple corridors, fantasy architecture, or game-environment scenery from the early comps.
- No generated champion likenesses. Production uses real Data Dragon art only.
- No condensed poster font substitution. Production keeps the established self-hosted type system.
- No invented JSON values, role statistics, footer links, copyright dates, or alternate logo marks.
- No multi-card champion wall or bordered code window.
- No gold glow as a substitute for composition; depth comes from scale, occlusion, and planes.

## Scene architecture

### Scene A: The mark / threshold

- First viewport communicates “something changed” with the live patch number.
- Existing monogram is cropped from the supplied mobile lockup and rendered as layered depth planes.
- The gold slash extends beyond the mark and exposes the next scene through the R’s negative space.
- Desktop: short pinned camera approach. Mobile: CSS-sticky approach with a smaller scale ratio. Reduced motion: static mark with the next state visible in the aperture.

### Scene B: Noise becomes signal

- Real current-patch note lines arrive as perspective strips.
- Irrelevant strips move behind the camera; exemplar or locally stored pool champions remain.
- Surviving strips widen into editorial champion apertures using Data Dragon art.
- The nearest aperture rotates flat and becomes the first exact delta.

### Scene C: Before becomes after

- One real delta dominates at a time; three examples occupy one shared stage, not three blocks.
- Old state displaces backward, new state takes its physical space, and the arrow grows into the history rail.
- Product metadata remains readable and linked.

### Scene D: Every patch leaves a trace

- The rail carries real patch numbers and one real champion’s history.
- Two patch planes overlap to make comparison spatial.
- The rail divides into five role paths; selecting a path is represented by depth and scale, while links remain conventional and accessible.

### Scene E: Inspectable / return

- Role paths converge into the indentation guides of the real normalized JSON fragment.
- The guides curve back into the original slash; the supplied logo reappears at compact scale.
- Final actions resolve beside the mark and the legal footer shares the same baseline.

## Transition architecture

1. **Patch change:** `26.15` is displaced by `26.16`; the changed digit travels onto the gold slash.
2. **Logo threshold:** the slash scales and the monogram’s upper negative space becomes a clip aperture into Scene B.
3. **Notes to pool:** all strips converge on the slash; selected strips widen into portrait masks.
4. **Pool to delta:** the nearest mask rotates to zero perspective; its stat line scales into the before value.
5. **Delta to history:** the arrow extends past the viewport and becomes the persistent patch rail.
6. **History to comparison:** two markers expand into overlapping version planes.
7. **Comparison to roles:** the outgoing edge of the newer plane splits into five spatial paths.
8. **Roles to source:** five paths converge to code indentation guides.
9. **Source to close:** guides collapse and align with the supplied monogram’s slash; the mark resolves at navigation scale.

No transition is owned by opacity alone. Opacity is used only for physically justified occlusion and depth falloff.

## What will be removed or replaced

- Replace the eight boxed homepage components and their per-section borders/padding.
- Replace the current per-section animation registration with named cinematic timelines and predictable cleanup.
- Remove the scroll cue.
- Replace the square champion grid with editorial aperture crops.
- Replace the role list with real role paths/links.
- Replace the boxed source fragment with open code aligned to the continuity rails.
- Recompose the footer on `/` while keeping the legal copy and all routes intact.

The product routes, data model, ingestion scripts, filters, pool storage, command palette, and non-homepage surfaces remain untouched.

## Component and motion architecture

```text
src/components/home/
  CinematicHome.astro       shared canvas and semantic scene ordering
  HeroPortal.astro          opening, logo threshold, live patch
  SignalField.astro         note strips and champion apertures
  DeltaStage.astro          exact before/after state transfer
  HistoryWeave.astro        history, comparison, role paths
  SourceReturn.astro        source proof, logo return, final CTA
  RiftMark.astro            supplied-logo crop/layers only

src/styles/home.css         shared spatial system and responsive/reduced variants
src/scripts/home-motion.ts  named timeline builders and lifecycle cleanup
```

Motion primitives:

- `CAMERA_EASE`: `cubic-bezier(0.77, 0, 0.175, 1)` equivalent for spatial movement.
- `SETTLE_EASE`: `power3.out` for revealed product information.
- Scroll-scrubbed camera changes use `ease: none`; authored changes inside the timeline use the two curves above.
- Transform, opacity, and clip-path only during scroll. No layout measurements per frame.
- One controlled `will-change` lifecycle per active scene.
- No infinite loops and no pointer-follow effects.

## Responsive interpretation

- Desktop uses five overlapping sticky stages and real perspective.
- Laptop reduces mark scale and plane count to preserve headline/action visibility.
- Mobile keeps the logo threshold, one note stream, one portrait aperture, one dominant delta, a vertical history rail, stacked role links, and a code-to-logo return.
- Mobile avoids ScrollTrigger pins; CSS sticky supplies continuity and GSAP only scrubs transforms.
- Ultrawide caps information line lengths but lets environmental geometry use the full canvas.

## Reduced motion

- Disable pins, scrubbing, perspective travel, and large scale changes.
- Render each scene at its resolved state with short optional color/opacity transitions.
- Keep the aperture, ribbon continuity, all headings, all deltas, role links, code, CTAs, and footer visible.
- No JS initialization is required for content completeness.

## Verification plan

- Preserve baseline unit/build results.
- Add homepage continuity and CTA tests, top-to-bottom/reverse scrolling, mid-page reload, resize, route navigation, mobile, and reduced motion checks.
- Verify no console errors, no pin spacers in reduced motion, and no horizontal overflow at 390, 1440, and 1920 widths.
- Capture desktop hero, logo-threshold, delta, history, source-return, and mobile references.
- Run mechanical design detection, animation review, and final visual critique after implementation.
- Compare built JS/CSS assets before and after; no Three.js dependency and no runaway animation loop.

---

# Revision 2 — Continuity architecture (2026-08-22)

**Status:** supersedes the *Scene architecture*, *Transition architecture*, *Component and motion
architecture*, *Responsive interpretation*, and *Reduced motion* sections above. The Delta Loom
world, palette, type, data plumbing, and product story are unchanged.

## Why the first implementation failed

The captured journey frames 1–6 (emblem approach, macro, threshold) worked; frames 7–10
collapsed into flat text sections in an empty void. Root causes, confirmed in code:

1. **Five separate scroll containers.** Each scene was its own `min-height: 300svh+` block with
   its own sticky stage and its own ScrollTrigger. Scene boundaries were real DOM and scroll
   boundaries, so "handoffs" were two different elements in two different compositing contexts
   that were never convincingly on screen as one composition.
2. **Opacity was the primary transition.** Nearly every element entered `opacity 0 → 1` and left
   `opacity → 0` inside its own scene. The world reset every ~3 viewport heights.
3. **No persistent environment.** After the hero, the "world" was a 1px seam and numerals at
   2–5% opacity — effectively a black void with floating text.

## Three continuity architectures considered

### A. The One-Take Stage — one sticky stage, one master timeline

One viewport-height stage stays stuck for the entire journey inside a single tall track
(~1400svh desktop). Every scene is an absolutely-positioned layer *inside the same stage*;
one master GSAP timeline with labeled beats is scrubbed by one ScrollTrigger across the track.
Persistent objects (the gold seam, the patch-number archive, the emblem) are single DOM nodes
transformed continuously across all beats. Native scroll remains sovereign (sticky + scrub, no
wheel interception).

### B. The Conserved-Matter Relay — repair the overlapping scenes

Keep the five overlapping sticky scenes but move every shared object into a fixed overlay
layer that never unmounts, handing matter across scene boundaries. Least rework, but the
fundamental flaw survives: scenes still own scroll geometry and compositing, so cross-scene
registration between the overlay and per-scene content is fragile at every boundary, and the
environment still resets per scene.

### C. The Z-Corridor — a literal 3D dolly

All stations placed at successive negative translateZ inside one perspective camera; scroll
translates the world toward the viewer. The purest "camera", but text at distant z renders
blurry and small, memory cost of full-size distant stations is high, and mobile GPUs struggle.

**Selected: A**, absorbing C's dolly technique locally (per-layer coordinated z/scale
transforms at the threshold and travel beats, where depth matters most, without a global
perspective corridor). B is rejected because it preserves the failure's root cause.

## The stage

```text
CinematicHome                        the track (~1400svh desktop, ~900svh mobile)
└── .journey__stage                  sticky, 100svh, overflow clip — the only viewport
    ├── .journey__env                persistent: monumental archive numerals + strata seams
    ├── station: signal              full-stage layer (revealed through the emblem aperture)
    ├── station: delta               full-stage layer
    ├── station: history             full-stage layer
    ├── station: source              full-stage layer
    ├── station: hero                opening copy, versions, meta
    ├── .journey__emblem             supplied-logo depth layers (RiftMark)
    └── .journey__seam               THE gold slash — one element, never fades, never leaves
```

All stations exist simultaneously; a station's root is gated with `autoAlpha` only while it is
fully off-camera (a technical focus/paint gate, never a visible transition — matter always
enters and leaves by transform, clip, or occlusion).

## The threshold (signature moment)

The signal station sits *behind* the emblem layers, clipped to an aperture that tracks the
emblem's negative-space counter (hand-matched keyframes — both are authored by the same
timeline, so they stay registered). Approaching = emblem and hero environment scale up around
a transform-origin near the counter while the station's clip grows with it. Crossing = the
clip expands past the viewport while the metal strokes slide out past the frame edges as
foreground occluders. There is no content swap and no fade: the world seen through the hole
is the world you land in.

## Persistent object inventory

1. **The seam** (one element): emblem slash extension → threshold constant → signal cutting
   line → delta arrow-rail → history timeline rail → forks echo into role paths → first code
   indentation guide → docks back into the reassembled emblem's slash angle.
2. **The archive numerals** (env layer): hero architecture → depth coordinates during signal →
   align to the history rail as patch markers → monumental comparison planes → engraved
   watermark behind the source code.
3. **The emblem**: opening object → architecture → exits past frame edges after crossing →
   reassembles from the frame edges at the return.
4. **Champion matter**: surviving note strips widen into portrait apertures; the front
   aperture flattens into the first delta's UI; its stat line scales into the big before value.

## Master timeline beats (desktop)

| # | Label | Weight | What happens |
|---|-------|-------:|--------------|
| 1 | `opening` | 1.0 | Still composition: 26.16, "Something changed.", emblem right, CTAs |
| 2 | `approach` | 1.2 | Camera toward emblem; layers separate in z; copy parallaxes off |
| 3 | `macro` | 0.8 | Emblem beyond viewport; strokes architectural; window prominent |
| 4 | `threshold` | 1.0 | Clip passes frame; strokes exit at edges; seam holds center |
| 5 | `landing` | 0.6 | Stillness inside the archive; denser numerals; quiet |
| 6 | `signal` | 1.6 | Real note strips arrive along the seam; the cut filters them; four apertures condense |
| 7 | `resolve` | 1.0 | Rear apertures recede past camera; front aperture flattens into delta UI |
| 8 | `delta` | 1.8 | Three real deltas; before displaced backward, after takes its place; arrow rides the seam |
| 9 | `rail` | 0.6 | The after-arrow stretches; seam becomes the history rail |
| 10 | `history` | 1.2 | Real patch nodes attach to the rail; camera tracks laterally |
| 11 | `compare` | 0.8 | Two monumental version planes overlap; compare link is their intersection |
| 12 | `roles` | 0.8 | Rail forks into five gold role paths with real counts |
| 13 | `source` | 1.4 | Paths align into code indentation guides; real JSON reveals along them |
| 14 | `return` | 1.2 | Rows collapse; emblem reassembles from frame edges; seam docks; final CTAs |

Beat positions are exposed as `window.__riftscryJourney.labels` (name → scroll fraction) for
deterministic test/frame capture.

## Static default, reduced motion, no-JS

The stylesheet's default state is the static cut: stations render as stacked, art-directed
full-viewport compositions in document order with all content, links, and the footer intact.
Only when motion boots (JS + no reduced-motion) does `motion-ready` switch the stage to
sticky/absolute mode. Reduced motion therefore requires no JS at all and never sees a pin,
a spacer, or an intermediate animation state.

## Mobile

Same single stage and beat structure on a ~900svh track with a simpler cut: shallower z,
two apertures, the same three deltas, a vertical-tracking history rail, stacked role paths,
and a shorter threshold. Not a de-pinned section list.

## Verification (updated)

- Beat-accurate frame capture via `window.__riftscryJourney` replaces per-scene offsets.
- e2e: reverse scrolling, mid-journey reload, resize, route navigation and back, no console
  errors, no horizontal overflow, reduced-motion completeness, focus never lands on a hidden
  station's links.
- The 10 acceptance frames must show one continuous world; if any frame reads as an
  independent webpage section, iterate before accepting.
