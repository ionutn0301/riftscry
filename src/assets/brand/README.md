# RiftScry brand assets

User-provided logo set. Ink + gold + cream identity — these marks anchor the site's
palette (see `docs/superpowers/specs/2026-08-21-riftscry-design.md` §10).

| File | Lockup | Use |
|---|---|---|
| `logo-desktop-light.png` | Horizontal wordmark (renders "RIFTΔ"), cream + gold | Primary. Desktop header / hero on dark backgrounds |
| `logo-desktop-dark.png` | Horizontal wordmark (renders "RIFTΔ"), ink + gold | Desktop on light backgrounds (docs, light OG) |
| `logo-mobile-light.png` | Stacked R monogram + RIFTSCRY wordmark, cream + gold (2026-08-21 update) | Primary mobile mark / splash / social cards on dark backgrounds |
| `logo-mobile-dark.png` | Stacked R monogram + RIFTSCRY wordmark, ink + gold (2026-08-21 update) | Mobile on light backgrounds |

Notes

- The mobile lockups were updated after the RiftScry rename and render "RIFTSCRY";
  the desktop wordmarks still render "RIFTΔ" and remain in use per the user's direction.
- Run marks through Astro's image pipeline (or pre-optimized derivatives) before
  shipping — do not hotlink the raw files at full size in the header.
- A favicon / small-size mark should be derived from the R monogram during implementation.
- Do not restyle, recolor, or add effects to the marks.
