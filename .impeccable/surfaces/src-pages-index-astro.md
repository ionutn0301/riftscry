---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/components/home","src/scripts/home-motion.ts","src/styles/home.css"]
---

# Homepage surface brief

- Scope/mode: `/`, Persuade/Experience hybrid.
- Audience/job: patch-aware League players should understand what changed for their champions and choose either the current patch or their champion pool.
- Proof/content: real current-patch deltas, local pool personalization, champion history, patch comparison, role filters, normalized open data, Riot provenance.
- Constraints: keep all routes and data architecture; preserve supplied logo, warm ink/cream/gold identity, self-hosted type, Data Dragon-only champion art, static output, accessibility, reduced motion, and performance.
- Direction: The Delta Loom, one-take stage architecture — one sticky viewport stage inside one tall track, all scenes as layers of a single composition, one master labeled timeline (beats exposed at `window.__riftscryJourney` for tests). Persistent matter: THE seam, the archive numerals, the emblem.
- Memorable moment: the signal world is revealed through the emblem's negative-space counter (a clip window registered to `--ap-x/--ap-y` growing in lockstep with the emblem's scale) and the camera crosses it without any fade or content swap.
- Resolved decisions: static CSS is the designed reduced/no-JS cut (each station's resolved still); `motion-ready` gates stage mode under `prefers-reduced-motion: no-preference`; hidden stations gate with `autoAlpha` so their links never take focus; desktop track 1400svh, mobile 900svh.
- Unresolved decisions: none blocking; further polish candidates are strip/headline overlap during the mobile signal beat and richer landing-beat strata.
