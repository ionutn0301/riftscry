# RiftScry brand assets

User-provided logo set (final RIFTSCRY marks, 2026-08-21). Ink + gold + cream identity —
these marks anchor the site's palette (see `docs/superpowers/specs/2026-08-21-riftscry-design.md` §10).

| File | Lockup | Use |
|---|---|---|
| `logo-desktop-light.png` | Horizontal R monogram ✦ RIFTSCRY, cream + gold | Primary. Desktop header / hero on dark backgrounds |
| `logo-desktop-dark.png` | Horizontal R monogram ✦ RIFTSCRY, ink + gold | Desktop on light backgrounds (docs, light OG) |
| `logo-mobile-light.png` | Stacked R monogram over RIFTSCRY, cream + gold | Primary mobile mark / splash / social cards on dark backgrounds |
| `logo-mobile-dark.png` | Stacked R monogram over RIFTSCRY, ink + gold | Mobile on light backgrounds |

Notes

- Run marks through Astro's image pipeline (or pre-optimized derivatives) before
  shipping — do not hotlink the raw files at full size in the header.
- A favicon / small-size mark should be derived from the R monogram during implementation.
- Do not restyle, recolor, or add effects to the marks.
