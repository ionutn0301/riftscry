# DESIGN.md — RiftScry "The Balance Ledger"

Committed visual world (user-approved 2026-08-21; anchored on the user's RIFTSCRY logo
set in `src/assets/brand/`). Incumbent authority: `src/styles/tokens.css`,
`src/styles/global.css`, components under `src/components/`.

## Concept

An editorial intelligence briefing about a game — annual-report-meets-wire-service, gilt-
edged ledger. NOT an esports template. Numbers (`45% → 40%`) are the brand's core visual
asset. DESIGN_VARIANCE 8 / MOTION_INTENSITY 9 / VISUAL_DENSITY 5.

## Palette (tokens.css)

- Environment: `--ink #131110`, raised `--ink-2 #1c1916`, `--ink-3`, rules `--line`,
  `--line-strong` — warm paper-dark, never blue-black.
- Text: `--cream #f1e9da`, `--cream-dim`, `--cream-faint`.
- Brand accent: gold `--gold #c99a4c` / `--gold-bright #e3b761` / `--gold-deep` — from
  the logo rift slashes. Reserved for the Δ mark, patch numbers, rules, emphasis.
  **Never a semantic change color.**
- Semantics: buff `--buff` (desaturated teal), nerf `--nerf` (ember), `--neutral`;
  always paired with ▲/▼/◆ glyph + text label (CVD-safe).

## Type

- Display: **Clash Display** (variable, self-hosted) — headlines, wordmark-scale moments.
- UI/body: **General Sans** (variable, self-hosted).
- Numerics: **Spline Sans Mono** with `tnum` (`.num` class) — every number on the site.
- Scale: fluid tokens `--text-*` up to `--text-colossal` (patch-number scale).

## Grammar

- Sharp corners (2px radii), 1px rules, gilt top-borders for emphasis panels.
- Elevation by border, not shadow (except overlays: palette/dialog use deep shadow).
- Strikethrough-before → gold arrow → bold-after is the canonical delta rendering.
- Dense information moments contrast with generous editorial whitespace.
- Champion imagery via ddragon (squares bordered `--line-strong`).

## Motion (Phase-3)

GSAP + ScrollTrigger, transform/opacity/clip-path only; no pins anywhere — the homepage
is one sticky stage scrubbed by a single master timeline; native scroll trustworthy;
designed reduced-motion variant. One authored moment per beat, no scattered effects.

## Homepage — Delta Loom (one-take stage)

The homepage is ONE viewport-sized stage that stays stuck for the whole journey inside a
single tall track (`~1400svh` desktop, `~900svh` mobile). Every scene is an absolutely-
positioned layer of that stage; one master GSAP timeline with labeled beats (`opening →
approach → macro → threshold → landing → signal → resolve → delta → rail → history →
compare → roles → source → return`) is scrubbed by one ScrollTrigger. There are no
per-scene scroll containers and no pins — native scroll stays sovereign.

Persistent matter is single DOM nodes transformed across all beats: THE gold seam
(logo slash → cutting line → delta rail → history rail → code indentation guide →
docked back into the mark), the archive numerals (hero architecture → depth coordinates
→ comparison planes → engraved watermark), and the emblem (object → architecture →
exits past the frame → reassembles at the return). The signal world sits behind the
emblem, clipped to an aperture registered to the mark's negative-space counter
(`--ap-x/--ap-y`); the crossing is the clip window outgrowing the frame — never a fade.
Opacity is only depth falloff or an off-camera visibility gate (`autoAlpha` keeps hidden
stations unfocusable).

The stylesheet's DEFAULT state is the static cut: stations render as stacked, designed
stills (each beat's resolved key-frame) with all content and links; `motion-ready` (only
under `prefers-reduced-motion: no-preference`) switches to stage mode. Reduced motion and
no-JS therefore share one complete, art-directed composition. Mobile runs the same beat
clock with shallower amplitudes and two champion apertures. No WebGL: DOM, the supplied
logo imagery, Data Dragon art, CSS, and GSAP remain the durable rendering stack.
