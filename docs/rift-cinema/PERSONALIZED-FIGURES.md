# Personalized foreground figures

Verified 2026-11-04 for the Urgot / Riven / Malphite homepage correction.

These assets are transparent foreground figures, intended to sit over the existing
shared Summoner's Rift environment. They must not be presented as rectangular
splash backgrounds. The source paintings are Riot artwork. The shipped alpha
cutouts are background-extraction edits made with the built-in image generation
tool; they are not unmodified official Riot transparent exports. Background
extraction can introduce small pixel differences, so do not claim pixel identity.

## Source discovery

The current official Wild Rift champion pages expose a 1600×900 hero video,
ability icons, and 1280×720 skin paintings in their embedded `__NEXT_DATA__`.
They do not expose equivalent transparent promotional PNGs for these three
champions. The official League champion pages expose the familiar Data Dragon
paintings at 1215×717. The Wild Rift base paintings were selected as the larger
official source, after visual comparison.

| Champion | Official source page | Original painting |
| --- | --- | --- |
| Urgot | https://wildrift.leagueoflegends.com/en-us/champions/urgot/ | https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/5fea00bed10d24becc8cd2bae09f3e7a24bbd91e-1280x720.jpg?accountingTag=WR |
| Riven | https://wildrift.leagueoflegends.com/en-us/champions/riven/ | https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data/da5b159255cb81cafeeb5487a7543f5017154e8f-1280x720.jpg?accountingTag=WR |
| Malphite | https://wildrift.leagueoflegends.com/en-us/champions/malphite/ | https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data/f82ce98f43caa4dd73e996313ad40eeda380a442-1280x720.jpg?accountingTag=WR |

All three source files are RGB JPEGs without alpha. Source SHA-256:

| Champion | Bytes | SHA-256 |
| --- | ---: | --- |
| Urgot | 92,165 | `25e4fa01ea538c443156436279b1655ebbe34f8edb9675026b8e62f2cecfc2f1` |
| Riven | 128,751 | `fe97f9f8b80d820038de763250b5b281f4b6d8887393982e7ca9f70090fa8d00` |
| Malphite | 126,539 | `dc6fb1cbdbc0d41811c825eda97afb17d3593c234d0e18a1184d515c36f3176f` |

## Transformation

Each source was passed separately as an edit target with
`transparent_background: true`. The edit requested background removal only,
with authentic identity, pose, colors, silhouette, and original clipped edges
preserved. No missing body parts were requested. The outputs were visually
inspected, then encoded to WebP using Sharp with `quality: 90`,
`alphaQuality: 100`, and `effort: 6`. No second compositing, recoloring, or
background-removal algorithm was applied.

The shared exact prompt prefix was:

> Use case: background-extraction. Asset type: transparent foreground champion figure for a game companion website. Input image 1 is the edit target, an authentic Riot painted champion image. Primary request: remove its background only, giving genuine alpha transparency.

The champion-specific prompt text was:

- **Riven:** Keep the airborne white-haired female champion Riven, her exact face, hair, armor, body, hands, legs, enormous fragmented green runic sword, and its attached green magical glow. Remove all ruins, ground, sky, distant architecture, and detached ground sparks. Preserve the original pose and sword silhouette.
- **Urgot:** Keep the central cyborg champion Urgot, his exact bald face, respirator and green hoses, white muscular arm, dark armor, his held mechanical weapon and connected mechanical legs/chassis. Remove the surrounding industrial walls, background hanging chains not attached to him, ambient background fog and all scenery. The original character extends off the bottom/right edge: retain those cropped edges faithfully; do not invent missing limbs or extend the body.
- **Malphite:** Keep only the immense central charging stone champion Malphite, his exact triangular rocky head with glowing green eyes and mouth, spiky rock shoulders, central body and his own visible forelimbs. Remove all humans/archers, weapons belonging to them, mountains, ground, sky, detached flying rubble, dust, and environmental flames. The character extends off the top/right edges: preserve those crop edges, do not invent extra anatomy.

The shared exact prompt suffix was:

> Invariants: preserve the original painted pixels, colors, lighting, anatomy, identity and proportions as faithfully as possible. Do not redraw, reinterpret, stylize, relight, recolor, add a ring or platform, add shadows, or extend the artwork beyond what is visible. Output a clean antialiased cutout with real transparent alpha, no checkerboard baked in, no text or watermark. Keep the original landscape canvas and subject placement, including original clipped edges.

## Framing

All three edited canvases are 1672×941 RGBA. Use foreground `contain` framing
with a per-champion scale and position; do not use full-screen `cover` rules.

| Shipped asset | Bytes | Fully transparent pixels | SHA-256 |
| --- | ---: | ---: | --- |
| `public/images/rift-cinema/urgot-figure.webp` | 253,148 | 430,869 | `0fb39a1b9609e4bdbcd32310c117f7d18ff0a4f4ba92a2d322f1f24587464cfd` |
| `public/images/rift-cinema/riven-figure.webp` | 283,038 | 952,323 | `6bc432def0d49d54ef35581bc92eee07e0d5131bf65a5ace28e4e493278d41c5` |
| `public/images/rift-cinema/malphite-figure.webp` | 233,038 | 699,792 | `c2360000ea097f333d5cd9f2cecc62fae9c1dbf89f04e46383f3e13062101d01` |

All three alpha channels span 0–255. The edited body pixels are predominantly
alpha 250–254, and edge/glow pixels retain partial transparency. WebP encoding
preserves the alpha channel exactly; no flattening was applied.

- **Riven:** A wide complete airborne pose; retain both the figure on the right
  and the long glowing sword on the left. Face focal point approximately
  72% / 28%. She can be scaled slightly larger than a full-width rectangle,
  but must not be cropped down to just the sword or face on mobile.
- **Urgot:** Heavy wide chassis; face focal point approximately 60% / 12%.
  Preserve the upper silhouette and let the existing hero edge treatment
  absorb the original lower/right crop. Do not expose a floating straight
  lower edge against a bright background.
- **Malphite:** A wide charging pose; face focal point approximately 67% / 67%.
  His rocky shoulders extend beyond the original top/right edges. Keep the
  face and left fist together in the visible region, with the hero frame
  handling those original crops.

## Coverage limits

These three files extend the curated painted-figure set only. They do not prove
that Riot publishes matching transparent foreground artwork for every LoL
champion. The existing official homepage provides Akali, Yasuo, Thresh, Lux,
Jinx, and Leona painted cutouts. The previously audited official asset ZIP
contains a small named PSD set, not the full roster.

The community wiki's `Champion renders` category has broad roster coverage,
but inspected Urgot and Malphite files were low-poly game-model renders. Those
were rejected because their style does not match the painted homepage figures.
Future champions need a verified official cutout or an individually reviewed
background extraction, plus provenance and framing metadata. A splash rectangle
must not silently stand in for a foreground figure.
