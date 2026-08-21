# PRODUCT.md — RiftScry

Product truth captured from the user-approved design spec
(`docs/superpowers/specs/2026-08-21-riftscry-design.md`) — approved via explicit gates on
2026-08-21. This file transcribes those decisions; it does not invent new ones.

## What it is

RiftScry turns Riot's prose League of Legends patch notes into structured before → after
changes, personalized to the champions a player actually plays. Zero-account, fully
static, open source. Tagline: **The patch notes, diffed.**

## Who it's for

Ranked players, one-tricks, returning players, theorycrafters, esports viewers — anyone
who wants "what changed for me?" answered in under 20 seconds, plus engineers evaluating
the repository itself.

## Core promise

- Player-facing patch identity (26.x).
- Exact numeric before → after values with deterministic buff/nerf classification
  (methodology documented, never an opaque score).
- My Pool personalization via localStorage; shareable URLs for everything.
- Provenance: every value traces to the official Riot notes; data versioned in git.

## Voice

Short, confident, game-aware. Examples: "Your main changed." / "See the delta." / "Know
before queue." Banned: "seamless", "powerful", "AI-powered", "revolutionary", marketing
adjective soup.

## Constraints

- Independent third-party product — Riot disclaimer always visible; Data Dragon assets
  only; no Riot chrome/Hextech imitation; never republish full prose notes.
- Zero backend at runtime. Static output only.
- Accessibility: keyboard-first navigation, CVD-safe semantics (glyph + label, never
  color alone), prefers-reduced-motion honored with a designed reduced variant.

## Surfaces

- `/` — cinematic scroll-narrative homepage (Persuade/Experience hybrid; storyboard fixed
  in spec §10: hero patch number, wall of notes, your champions, the delta, history,
  role impact, open source, closing).
- `/patch/:id`, `/champion/:slug`, `/compare/:a/:b`, `/patches`, `/champions`, `/pool` —
  Operate/Read surfaces, already built; incumbent visual authority.
- ⌘K command palette on every page.
