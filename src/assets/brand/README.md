# RIFTΔ brand assets

User-provided logo set (2026-08-21). Ink + gold + cream identity — these marks anchor
the site's palette (see `docs/superpowers/specs/2026-08-21-riftdelta-design.md` §10).

| File | Lockup | Use |
|---|---|---|
| `logo-desktop-light.png` | Horizontal wordmark, cream + gold | Primary. Desktop header / hero on dark backgrounds |
| `logo-desktop-dark.png` | Horizontal wordmark, ink + gold | Desktop on light backgrounds (docs, light OG) |
| `logo-mobile-gold.png` | Stacked R monogram + wordmark, gold-trimmed ink | Mobile hero / splash / social cards on dark backgrounds |
| `logo-mobile-dark.png` | Stacked R monogram + wordmark, flat ink + gold | Mobile on light backgrounds |

Notes

- Source PNGs as provided; run through Astro's image pipeline (or pre-optimized
  derivatives) before shipping — do not hotlink the raw files at full size in the header.
- A favicon / small-size mark should be derived from the R monogram during implementation.
- Do not restyle, recolor, or add effects to the marks.
