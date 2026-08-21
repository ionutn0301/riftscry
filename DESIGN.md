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

GSAP + ScrollTrigger, transform/opacity/clip-path only; short pins; native scroll
trustworthy; designed reduced-motion variant; mobile sequences non-pinned. One authored
moment per scene, no scattered effects.
